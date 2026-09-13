-- Same class of issue as 0008_reconcile_legacy_baseline: pixxel_prod (and
-- pixxel_stg) never picked up `hero_diagram_id` on `assets`. The migration
-- that added it (0001_fearless_deathstrike.sql) is recorded as applied in
-- __drizzle_migrations on those environments, but the column is missing —
-- the file's content diverged from what actually ran there at the time,
-- so drizzle's migrate() won't retry it. Every asset create/list request
-- 500s as a result ("Failed to create asset." / "Failed to load assets."),
-- since app/api/assets/route.ts unconditionally selects/inserts this column.
-- ADD COLUMN IF NOT EXISTS is a no-op on dev/pixxel, where it already exists.
ALTER TABLE `assets` ADD COLUMN IF NOT EXISTS `hero_diagram_id` char(36);
