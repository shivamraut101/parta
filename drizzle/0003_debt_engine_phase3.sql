CREATE TYPE public.debt_target_type AS ENUM ('BANK_CC', 'LOCAL_LOAN');
CREATE TYPE public.debt_payment_source AS ENUM ('CASH', 'UPI');

CREATE TABLE IF NOT EXISTS public.debt_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  date date NOT NULL,
  target_type public.debt_target_type NOT NULL,
  source public.debt_payment_source NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX debt_payments_shop_date_idx
  ON public.debt_payments(shop_id, date);

CREATE TABLE IF NOT EXISTS public.daily_interest_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  date date NOT NULL,
  cc_interest_accrued numeric(18,6) NOT NULL DEFAULT 0,
  local_interest_accrued numeric(18,6) NOT NULL DEFAULT 0,
  total_interest_drain numeric(18,6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_interest_logs_shop_id_date_unique UNIQUE (shop_id, date)
);

CREATE INDEX daily_interest_logs_shop_date_idx
  ON public.daily_interest_logs(shop_id, date);

ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_interest_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY debt_payments_owner_select
ON public.debt_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = debt_payments.shop_id
      AND s.owner_id = auth.uid()
  )
);

CREATE POLICY debt_payments_owner_insert
ON public.debt_payments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = debt_payments.shop_id
      AND s.owner_id = auth.uid()
  )
);

CREATE POLICY daily_interest_logs_owner_select
ON public.daily_interest_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = daily_interest_logs.shop_id
      AND s.owner_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.log_daily_interest_for_date(target_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.daily_interest_logs (
    shop_id,
    date,
    cc_interest_accrued,
    local_interest_accrued,
    total_interest_drain
  )
  SELECT
    fc.shop_id,
    target_date,
    (fc.cc_limit * fc.bank_interest_rate_pa / 365),
    (fc.cc_limit * (fc.local_loan_apr_monthly * 12) / 365),
    ((fc.cc_limit * fc.bank_interest_rate_pa / 365) + (fc.cc_limit * (fc.local_loan_apr_monthly * 12) / 365))
  FROM public.financial_configs fc
  ON CONFLICT (shop_id, date)
  DO UPDATE SET
    cc_interest_accrued = excluded.cc_interest_accrued,
    local_interest_accrued = excluded.local_interest_accrued,
    total_interest_drain = excluded.total_interest_drain;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('log_daily_interest_2359');
EXCEPTION
  WHEN undefined_function THEN NULL;
  WHEN invalid_parameter_value THEN NULL;
END;
$$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'log_daily_interest_2359',
    '59 23 * * *',
    $$SELECT public.log_daily_interest_for_date(current_date);$$
  );
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'pg_cron not available; schedule manually after enabling extension.';
END;
$$;
