CREATE TYPE debt_account_kind AS ENUM (
  'BANK_CC',
  'BANK_TERM_LOAN',
  'BANK_OD',
  'BANK_BILL_DISCOUNT',
  'LOCAL_DAILY',
  'LOCAL_MONTHLY',
  'LOCAL_BULLET',
  'LOCAL_FLEXI'
);

CREATE TYPE debt_rate_input_type AS ENUM (
  'ANNUAL_PERCENT',
  'MONTHLY_PERCENT',
  'DAILY_FIXED',
  'EMI_DAILY',
  'EMI_MONTHLY'
);

CREATE TYPE debt_installment_frequency AS ENUM (
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'BULLET'
);

CREATE TABLE debt_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  lender_name varchar(160),
  kind debt_account_kind NOT NULL,
  rate_input_type debt_rate_input_type NOT NULL DEFAULT 'ANNUAL_PERCENT',
  principal_amount numeric(18, 2) NOT NULL DEFAULT '0',
  outstanding_amount numeric(18, 2) NOT NULL DEFAULT '0',
  annual_rate_pa numeric(10, 6) NOT NULL DEFAULT '0',
  monthly_rate numeric(10, 6) NOT NULL DEFAULT '0',
  daily_fixed_interest numeric(18, 2) NOT NULL DEFAULT '0',
  installment_amount numeric(18, 2) NOT NULL DEFAULT '0',
  installment_frequency debt_installment_frequency NOT NULL DEFAULT 'MONTHLY',
  remaining_installments integer NOT NULL DEFAULT 0,
  start_date date,
  maturity_date date,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX debt_accounts_shop_active_idx ON debt_accounts(shop_id, is_active);
CREATE INDEX debt_accounts_shop_kind_idx ON debt_accounts(shop_id, kind);

ALTER TABLE debt_payments
  ADD COLUMN debt_account_id uuid REFERENCES debt_accounts(id) ON DELETE SET NULL;

CREATE INDEX debt_payments_shop_account_idx ON debt_payments(shop_id, debt_account_id);
