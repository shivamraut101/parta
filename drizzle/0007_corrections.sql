-- Sprint 2 Phase B: Void / Correction columns + corrections table

-- Add void columns to daily_summaries
ALTER TABLE daily_summaries
  ADD COLUMN IF NOT EXISTS is_voided boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS void_reason text;

-- Corrections log
CREATE TABLE IF NOT EXISTS corrections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  entity_type varchar(80) NOT NULL,
  entity_id   uuid NOT NULL,
  reason      text NOT NULL,
  corrected_by uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS corrections_shop_entity_idx
  ON corrections(shop_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS corrections_shop_created_idx
  ON corrections(shop_id, created_at);

-- RLS for corrections
ALTER TABLE corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY corrections_owner_select ON corrections
  FOR SELECT USING (
    shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())
  );

CREATE POLICY corrections_owner_insert ON corrections
  FOR INSERT WITH CHECK (
    shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())
  );
