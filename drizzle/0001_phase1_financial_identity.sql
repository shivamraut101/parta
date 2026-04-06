CREATE TABLE IF NOT EXISTS public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financial_configs (
  shop_id uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  cc_limit numeric(18,2) NOT NULL DEFAULT 0,
  bank_interest_rate_pa numeric(10,6) NOT NULL DEFAULT 0,
  daily_local_drain numeric(18,2) NOT NULL DEFAULT 0,
  local_loan_apr_monthly numeric(10,6) NOT NULL DEFAULT 0,
  base_margin_default numeric(10,6) NOT NULL DEFAULT 20,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY shops_owner_select
ON public.shops
FOR SELECT
USING (owner_id = auth.uid());

CREATE POLICY shops_owner_update
ON public.shops
FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY financial_configs_owner_select
ON public.financial_configs
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = financial_configs.shop_id
      AND s.owner_id = auth.uid()
  )
);

CREATE POLICY financial_configs_owner_update
ON public.financial_configs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = financial_configs.shop_id
      AND s.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = financial_configs.shop_id
      AND s.owner_id = auth.uid()
  )
);
