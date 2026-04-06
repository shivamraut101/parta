ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS primary_color varchar(20);
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS brand_name varchar(160);
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS currency_symbol varchar(8) NOT NULL DEFAULT '₹';

CREATE TABLE IF NOT EXISTS public.monthly_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  month_year varchar(7) NOT NULL,
  total_interest_paid numeric(18,2) NOT NULL DEFAULT 0,
  total_net_profit numeric(18,2) NOT NULL DEFAULT 0,
  turnover_velocity numeric(18,6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monthly_snapshots_shop_month_unique UNIQUE (shop_id, month_year)
);

CREATE INDEX IF NOT EXISTS monthly_snapshots_shop_month_idx
  ON public.monthly_snapshots(shop_id, month_year);

ALTER TABLE public.monthly_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY monthly_snapshots_owner_select
ON public.monthly_snapshots
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = monthly_snapshots.shop_id
      AND s.owner_id = auth.uid()
  )
);

CREATE POLICY monthly_snapshots_owner_insert
ON public.monthly_snapshots
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = monthly_snapshots.shop_id
      AND s.owner_id = auth.uid()
  )
);

CREATE POLICY monthly_snapshots_owner_update
ON public.monthly_snapshots
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = monthly_snapshots.shop_id
      AND s.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = monthly_snapshots.shop_id
      AND s.owner_id = auth.uid()
  )
);
