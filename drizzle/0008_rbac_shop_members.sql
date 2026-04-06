-- Sprint 2 Phase B: RBAC — shop_members table

DO $$ BEGIN
  CREATE TYPE shop_member_role AS ENUM ('OWNER', 'MANAGER', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS shop_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  role       shop_member_role NOT NULL DEFAULT 'VIEWER',
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_members_shop_user_unique UNIQUE (shop_id, user_id)
);

CREATE INDEX IF NOT EXISTS shop_members_shop_user_idx
  ON shop_members(shop_id, user_id);

-- RLS
ALTER TABLE shop_members ENABLE ROW LEVEL SECURITY;

-- Shop owner can see and manage all members
CREATE POLICY shop_members_owner_all ON shop_members
  FOR ALL USING (
    shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())
  );

-- A member can see their own membership
CREATE POLICY shop_members_self_select ON shop_members
  FOR SELECT USING (user_id = auth.uid());

-- Seed the owner's own membership row for existing shops
-- (Run manually if needed: INSERT INTO shop_members (shop_id, user_id, role)
--  SELECT id, owner_id, 'OWNER' FROM shops ON CONFLICT DO NOTHING;)
