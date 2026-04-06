CREATE TYPE public.supplier_transaction_type AS ENUM ('PURCHASE', 'PAYMENT', 'RETURN');

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  contact_number varchar(20),
  category varchar(80) NOT NULL,
  current_balance numeric(18,2) NOT NULL DEFAULT 0,
  last_payment_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX suppliers_shop_name_idx
  ON public.suppliers(shop_id, name);

CREATE TABLE IF NOT EXISTS public.supplier_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  type public.supplier_transaction_type NOT NULL,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX supplier_transactions_supplier_created_idx
  ON public.supplier_transactions(supplier_id, created_at);

CREATE INDEX supplier_transactions_shop_created_idx
  ON public.supplier_transactions(shop_id, created_at);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY suppliers_owner_select
ON public.suppliers
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = suppliers.shop_id
      AND s.owner_id = auth.uid()
  )
);

CREATE POLICY suppliers_owner_insert
ON public.suppliers
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = suppliers.shop_id
      AND s.owner_id = auth.uid()
  )
);

CREATE POLICY suppliers_owner_update
ON public.suppliers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = suppliers.shop_id
      AND s.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = suppliers.shop_id
      AND s.owner_id = auth.uid()
  )
);

CREATE POLICY supplier_transactions_owner_select
ON public.supplier_transactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = supplier_transactions.shop_id
      AND s.owner_id = auth.uid()
  )
);

CREATE POLICY supplier_transactions_owner_insert
ON public.supplier_transactions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = supplier_transactions.shop_id
      AND s.owner_id = auth.uid()
  )
);

CREATE POLICY supplier_transactions_owner_update
ON public.supplier_transactions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = supplier_transactions.shop_id
      AND s.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = supplier_transactions.shop_id
      AND s.owner_id = auth.uid()
  )
);
