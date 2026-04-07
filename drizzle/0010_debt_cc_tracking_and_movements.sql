DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'debt_account_movement_type'
  ) THEN
    CREATE TYPE debt_account_movement_type AS ENUM (
      'OPENING',
      'DRAWDOWN',
      'REPAYMENT',
      'ADJUSTMENT'
    );
  END IF;
END;
$$;

ALTER TABLE debt_accounts
  ADD COLUMN IF NOT EXISTS credit_limit numeric(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_drawn_amount numeric(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_repaid_amount numeric(18, 2) NOT NULL DEFAULT 0;

UPDATE debt_accounts da
SET credit_limit = CASE
  WHEN da.kind = 'BANK_CC' THEN coalesce(fc.cc_limit, da.principal_amount, da.outstanding_amount, 0)
  ELSE coalesce(da.principal_amount, da.outstanding_amount, 0)
END
FROM financial_configs fc
WHERE fc.shop_id = da.shop_id
  AND da.credit_limit = 0;

WITH repaid AS (
  SELECT
    dp.debt_account_id,
    coalesce(sum(dp.amount), 0)::numeric(18, 2) AS total_repaid
  FROM debt_payments dp
  WHERE dp.debt_account_id IS NOT NULL
  GROUP BY dp.debt_account_id
)
UPDATE debt_accounts da
SET
  total_repaid_amount = coalesce(r.total_repaid, 0),
  total_drawn_amount = GREATEST(
    coalesce(da.principal_amount, 0),
    coalesce(da.outstanding_amount, 0) + coalesce(r.total_repaid, 0)
  )
FROM repaid r
WHERE da.id = r.debt_account_id;

UPDATE debt_accounts
SET total_drawn_amount = GREATEST(coalesce(principal_amount, 0), coalesce(outstanding_amount, 0))
WHERE total_drawn_amount = 0;

CREATE TABLE IF NOT EXISTS debt_account_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  debt_account_id uuid NOT NULL REFERENCES debt_accounts(id) ON DELETE CASCADE,
  movement_type debt_account_movement_type NOT NULL,
  amount numeric(18, 2) NOT NULL DEFAULT 0,
  movement_date date NOT NULL,
  source debt_payment_source,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS debt_account_movements_shop_date_idx
  ON debt_account_movements(shop_id, movement_date);

CREATE INDEX IF NOT EXISTS debt_account_movements_shop_account_idx
  ON debt_account_movements(shop_id, debt_account_id);
