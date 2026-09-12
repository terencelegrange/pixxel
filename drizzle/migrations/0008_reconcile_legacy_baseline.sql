-- Some environments (e.g. an older production database) had their `users`
-- table created before `token_version` existed in the schema, by the old
-- hand-written bootstrap in lib/db.ts that predates versioned migrations.
-- 0000_initial_schema.sql's `CREATE TABLE IF NOT EXISTS users` no-ops on an
-- already-existing table without backfilling missing columns onto it, so
-- token_version needs its own idempotent ALTER here. Safe everywhere else
-- (including dev, where it already exists) since ADD COLUMN IF NOT EXISTS
-- is a no-op when the column is already present.
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `token_version` int unsigned NOT NULL DEFAULT 1;
