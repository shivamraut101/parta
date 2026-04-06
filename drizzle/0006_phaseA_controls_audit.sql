CREATE TABLE IF NOT EXISTS "daily_closures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL REFERENCES "shops"("id") ON DELETE cascade,
  "closure_date" date NOT NULL,
  "is_locked" boolean NOT NULL DEFAULT true,
  "closed_by" uuid,
  "reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "daily_closures_shop_date_unique"
  ON "daily_closures" ("shop_id", "closure_date");
CREATE INDEX IF NOT EXISTS "daily_closures_shop_date_idx"
  ON "daily_closures" ("shop_id", "closure_date");

CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL REFERENCES "shops"("id") ON DELETE cascade,
  "actor_user_id" uuid NOT NULL,
  "event_date" date NOT NULL,
  "event_type" varchar(120) NOT NULL,
  "entity_type" varchar(120) NOT NULL,
  "entity_id" text,
  "payload" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "audit_events_shop_date_idx"
  ON "audit_events" ("shop_id", "event_date");
CREATE INDEX IF NOT EXISTS "audit_events_shop_created_idx"
  ON "audit_events" ("shop_id", "created_at");

ALTER TABLE "daily_closures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_closures_select_owner" ON "daily_closures";
CREATE POLICY "daily_closures_select_owner" ON "daily_closures"
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "shops"
    WHERE "shops"."id" = "daily_closures"."shop_id"
      AND "shops"."owner_id" = auth.uid()
  )
);

DROP POLICY IF EXISTS "daily_closures_modify_owner" ON "daily_closures";
CREATE POLICY "daily_closures_modify_owner" ON "daily_closures"
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM "shops"
    WHERE "shops"."id" = "daily_closures"."shop_id"
      AND "shops"."owner_id" = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "shops"
    WHERE "shops"."id" = "daily_closures"."shop_id"
      AND "shops"."owner_id" = auth.uid()
  )
);

DROP POLICY IF EXISTS "audit_events_select_owner" ON "audit_events";
CREATE POLICY "audit_events_select_owner" ON "audit_events"
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "shops"
    WHERE "shops"."id" = "audit_events"."shop_id"
      AND "shops"."owner_id" = auth.uid()
  )
);

DROP POLICY IF EXISTS "audit_events_insert_owner" ON "audit_events";
CREATE POLICY "audit_events_insert_owner" ON "audit_events"
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM "shops"
    WHERE "shops"."id" = "audit_events"."shop_id"
      AND "shops"."owner_id" = auth.uid()
  )
);
