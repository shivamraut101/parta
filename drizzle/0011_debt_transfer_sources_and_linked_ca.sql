ALTER TYPE debt_payment_source ADD VALUE IF NOT EXISTS 'NEFT';
ALTER TYPE debt_payment_source ADD VALUE IF NOT EXISTS 'IMPS';
ALTER TYPE debt_payment_source ADD VALUE IF NOT EXISTS 'CC_TO_CA_TRANSFER';
ALTER TYPE debt_payment_source ADD VALUE IF NOT EXISTS 'CA_TO_CC_TRANSFER';

ALTER TABLE debt_accounts
  ADD COLUMN IF NOT EXISTS linked_current_account_name varchar(160);
