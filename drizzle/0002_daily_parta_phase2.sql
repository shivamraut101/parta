CREATE TYPE public.expense_category AS ENUM (
  'STAFF_ADVANCE',
  'TEA_SNACKS',
  'UTILITIES',
  'REPAIRS',
  'MISC'
);

CREATE TABLE IF NOT EXISTS public.daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  date date NOT NULL,
  total_sales_cash numeric(18,2) NOT NULL DEFAULT 0,
  total_sales_upi numeric(18,2) NOT NULL DEFAULT 0,
  margin_applied numeric(10,6) NOT NULL DEFAULT 20,
  estimated_gross_profit numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_summaries_shop_id_date_unique UNIQUE (shop_id, date)
);

CREATE INDEX daily_summaries_shop_date_idx
  ON public.daily_summaries(shop_id, date);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  category public.expense_category NOT NULL,
  description text,
  expense_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX expenses_shop_date_idx
  ON public.expenses(shop_id, expense_date);

ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY daily_summaries_owner_select
ON public.daily_summaries
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = daily_summaries.shop_id
      AND s.owner_id = auth.uid()
  )
);

CREATE POLICY daily_summaries_owner_insert
ON public.daily_summaries
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = daily_summaries.shop_id
      AND s.owner_id = auth.uid()
  )
);

CREATE POLICY daily_summaries_owner_update
ON public.daily_summaries
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = daily_summaries.shop_id
      AND s.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = daily_summaries.shop_id
      AND s.owner_id = auth.uid()
  )
);

CREATE POLICY expenses_owner_select
ON public.expenses
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = expenses.shop_id
      AND s.owner_id = auth.uid()
  )
);

CREATE POLICY expenses_owner_insert
ON public.expenses
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = expenses.shop_id
      AND s.owner_id = auth.uid()
  )
);

CREATE POLICY expenses_owner_update
ON public.expenses
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = expenses.shop_id
      AND s.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = expenses.shop_id
      AND s.owner_id = auth.uid()
  )
);
