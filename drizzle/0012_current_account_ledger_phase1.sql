DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'ca_movement_type'
  ) THEN
    CREATE TYPE ca_movement_type AS ENUM (
      'SALES_INFLOW',
      'CC_DRAWDOWN_INFLOW',
      'EXTERNAL_DEPOSIT_INFLOW',
      'SUPPLIER_PAYMENT_OUTFLOW',
      'CC_REPAYMENT_OUTFLOW',
      'EXPENSE_OUTFLOW',
      'ADJUSTMENT'
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'ca_source_type'
  ) THEN
    CREATE TYPE ca_source_type AS ENUM (
      'SALES',
      'DEBT_DRAWDOWN',
      'SUPPLIER_PAYMENT',
      'EXPENSE',
      'DEBT_REPAYMENT',
      'MANUAL_ADJUSTMENT'
    );
  END IF;
END;
$$;

ALTER TABLE debt_accounts
  ADD COLUMN IF NOT EXISTS linked_current_account_name varchar(160);

ALTER TYPE debt_payment_source ADD VALUE IF NOT EXISTS 'NEFT';
ALTER TYPE debt_payment_source ADD VALUE IF NOT EXISTS 'IMPS';
ALTER TYPE debt_payment_source ADD VALUE IF NOT EXISTS 'CC_TO_CA_TRANSFER';
ALTER TYPE debt_payment_source ADD VALUE IF NOT EXISTS 'CA_TO_CC_TRANSFER';

CREATE TABLE IF NOT EXISTS current_account_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  account_name varchar(160) NOT NULL,
  account_number varchar(50),
  bank_name varchar(160),
  ifsc_code varchar(20),
  opening_balance numeric(18, 2) NOT NULL DEFAULT 0,
  start_date date,
  current_balance numeric(18, 2) NOT NULL DEFAULT 0,
  last_reconciled_date date,
  last_reconciled_balance numeric(18, 2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT current_account_accounts_shop_id_unique UNIQUE (shop_id)
);

CREATE INDEX IF NOT EXISTS current_account_accounts_shop_idx
  ON current_account_accounts(shop_id);

CREATE TABLE IF NOT EXISTS current_account_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  movement_date date NOT NULL,
  movement_type ca_movement_type NOT NULL,
  amount numeric(18, 2) NOT NULL DEFAULT 0,
  direction integer NOT NULL,
  source_type ca_source_type,
  source_id uuid,
  linked_debt_account_id uuid REFERENCES debt_accounts(id) ON DELETE SET NULL,
  linked_debt_movement_id uuid REFERENCES debt_account_movements(id) ON DELETE SET NULL,
  description text,
  notes text,
  balance_after numeric(18, 2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS current_account_movements_shop_date_idx
  ON current_account_movements(shop_id, movement_date);

CREATE INDEX IF NOT EXISTS current_account_movements_shop_type_idx
  ON current_account_movements(shop_id, movement_type);

CREATE INDEX IF NOT EXISTS current_account_movements_debt_link_idx
  ON current_account_movements(linked_debt_movement_id);

CREATE INDEX IF NOT EXISTS current_account_movements_source_idx
  ON current_account_movements(shop_id, source_type, source_id);

CREATE UNIQUE INDEX IF NOT EXISTS current_account_movements_shop_source_unique
  ON current_account_movements(shop_id, source_type, source_id);

ALTER TABLE debt_account_movements
  ADD COLUMN IF NOT EXISTS linked_ca_movement_id uuid;

INSERT INTO current_account_accounts (shop_id, account_name, opening_balance, current_balance)
SELECT
  s.id,
  coalesce(max(nullif(da.linked_current_account_name, '')), 'Current Account') AS account_name,
  0,
  0
FROM shops s
LEFT JOIN debt_accounts da
  ON da.shop_id = s.id
GROUP BY s.id
ON CONFLICT (shop_id) DO NOTHING;

INSERT INTO current_account_movements (
  shop_id,
  movement_date,
  movement_type,
  amount,
  direction,
  source_type,
  source_id,
  linked_debt_account_id,
  linked_debt_movement_id,
  description,
  notes
)
SELECT
  dam.shop_id,
  dam.movement_date,
  CASE
    WHEN dam.source::text = 'CC_TO_CA_TRANSFER' THEN 'CC_DRAWDOWN_INFLOW'::ca_movement_type
    ELSE 'CC_REPAYMENT_OUTFLOW'::ca_movement_type
  END,
  dam.amount,
  CASE
    WHEN dam.source::text = 'CC_TO_CA_TRANSFER' THEN 1
    ELSE -1
  END,
  CASE
    WHEN dam.source::text = 'CC_TO_CA_TRANSFER' THEN 'DEBT_DRAWDOWN'::ca_source_type
    ELSE 'DEBT_REPAYMENT'::ca_source_type
  END,
  dam.id,
  dam.debt_account_id,
  dam.id,
  CASE
    WHEN dam.source::text = 'CC_TO_CA_TRANSFER' THEN 'Backfill: CC drawdown inflow to CA'
    ELSE 'Backfill: CA repayment transfer to CC'
  END,
  dam.notes
FROM debt_account_movements dam
WHERE dam.source::text IN ('CC_TO_CA_TRANSFER', 'CA_TO_CC_TRANSFER')
ON CONFLICT (shop_id, source_type, source_id) DO NOTHING;

INSERT INTO current_account_movements (
  shop_id,
  movement_date,
  movement_type,
  amount,
  direction,
  source_type,
  source_id,
  description
)
SELECT
  ds.shop_id,
  ds.date,
  'SALES_INFLOW'::ca_movement_type,
  (coalesce(ds.total_sales_cash, 0) + coalesce(ds.total_sales_upi, 0))::numeric(18, 2),
  1,
  'SALES'::ca_source_type,
  ds.id,
  'Backfill: Daily sales inflow'
FROM daily_summaries ds
WHERE coalesce(ds.is_voided, false) = false
  AND (coalesce(ds.total_sales_cash, 0) + coalesce(ds.total_sales_upi, 0)) > 0
ON CONFLICT (shop_id, source_type, source_id) DO NOTHING;

INSERT INTO current_account_movements (
  shop_id,
  movement_date,
  movement_type,
  amount,
  direction,
  source_type,
  source_id,
  description,
  notes
)
SELECT
  e.shop_id,
  e.expense_date,
  'EXPENSE_OUTFLOW'::ca_movement_type,
  e.amount,
  -1,
  'EXPENSE'::ca_source_type,
  e.id,
  'Backfill: Expense outflow',
  e.description
FROM expenses e
WHERE coalesce(e.amount, 0) > 0
ON CONFLICT (shop_id, source_type, source_id) DO NOTHING;

INSERT INTO current_account_movements (
  shop_id,
  movement_date,
  movement_type,
  amount,
  direction,
  source_type,
  source_id,
  description,
  notes
)
SELECT
  st.shop_id,
  st.created_at::date,
  'SUPPLIER_PAYMENT_OUTFLOW'::ca_movement_type,
  st.amount,
  -1,
  'SUPPLIER_PAYMENT'::ca_source_type,
  st.id,
  'Backfill: Supplier payment outflow',
  st.note
FROM supplier_transactions st
WHERE st.type = 'PAYMENT'
  AND coalesce(st.amount, 0) > 0
ON CONFLICT (shop_id, source_type, source_id) DO NOTHING;

UPDATE debt_account_movements dam
SET linked_ca_movement_id = cam.id
FROM current_account_movements cam
WHERE dam.linked_ca_movement_id IS NULL
  AND cam.linked_debt_movement_id = dam.id;

WITH net AS (
  SELECT
    cam.shop_id,
    coalesce(sum(CASE WHEN cam.direction = 1 THEN cam.amount ELSE -cam.amount END), 0)::numeric(18, 2) AS net_change
  FROM current_account_movements cam
  GROUP BY cam.shop_id
)
UPDATE current_account_accounts caa
SET
  current_balance = (coalesce(caa.opening_balance, 0) + coalesce(net.net_change, 0))::numeric(18, 2),
  updated_at = now()
FROM net
WHERE caa.shop_id = net.shop_id;

WITH ordered AS (
  SELECT
    cam.id,
    cam.shop_id,
    sum(CASE WHEN cam.direction = 1 THEN cam.amount ELSE -cam.amount END)
      OVER (PARTITION BY cam.shop_id ORDER BY cam.movement_date, cam.created_at, cam.id)
      AS running_delta
  FROM current_account_movements cam
), base AS (
  SELECT
    caa.shop_id,
    coalesce(caa.opening_balance, 0) AS opening_balance
  FROM current_account_accounts caa
)
UPDATE current_account_movements cam
SET balance_after = (base.opening_balance + ordered.running_delta)::numeric(18, 2)
FROM ordered
JOIN base ON base.shop_id = ordered.shop_id
WHERE cam.id = ordered.id;
