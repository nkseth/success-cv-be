# Database Production Migration Guide

This document provides a comprehensive guide for managing database migrations in production environments using Drizzle ORM.

## Table of Contents

1. [Understanding Drizzle Migrations](#understanding-drizzle-migrations)
2. [Pre-Migration Checklist](#pre-migration-checklist)
3. [Step-by-Step Production Migration](#step-by-step-production-migration)
4. [Rollback Procedures](#rollback-procedures)
5. [Zero-Downtime Migrations](#zero-downtime-migrations)
6. [Common Issues & Solutions](#common-issues--solutions)
7. [Best Practices](#best-practices)

---

## Understanding Drizzle Migrations

### Migration Components

Drizzle migrations consist of three key components:

1. **SQL Migration Files** (`drizzle/*.sql`)
   - Contains the actual SQL statements
   - Named with pattern: `{index}_{name}.sql`

2. **Snapshot Files** (`drizzle/meta/*_snapshot.json`)
   - Schema state after each migration
   - Used by drizzle-kit for diff generation

3. **Journal** (`drizzle/meta/_journal.json`)
   - Tracks migration order and metadata
   - Must be in sync with SQL files

### Database Migration Tracking

Drizzle stores applied migrations in: `drizzle.__drizzle_migrations`

```sql
-- Check applied migrations
SELECT hash, created_at 
FROM drizzle.__drizzle_migrations 
ORDER BY created_at;
```

---

## Pre-Migration Checklist

### Before Any Production Migration

- [ ] **Backup the database**
  ```bash
  pg_dump -h HOST -U USER -d DATABASE > backup_$(date +%Y%m%d_%H%M%S).sql
  ```

- [ ] **Test migrations on staging first**
  - Apply migrations to a staging environment
  - Run full application test suite
  - Verify data integrity

- [ ] **Review migration SQL**
  ```bash
  cat drizzle/00XX_migration_name.sql
  ```

- [ ] **Check for destructive operations**
  - `DROP TABLE` / `DROP COLUMN` - Data loss!
  - `TRUNCATE` - Data loss!
  - `ALTER TABLE ... DROP` - Data loss!
  - Column type changes - Potential data loss!

- [ ] **Estimate migration time**
  ```sql
  -- Check table sizes
  SELECT schemaname, relname, n_live_tup 
  FROM pg_stat_user_tables 
  ORDER BY n_live_tup DESC;
  ```

- [ ] **Schedule maintenance window** (if needed)

---

## Step-by-Step Production Migration

### Method 1: Using drizzle-kit (Recommended)

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
pnpm install

# 3. Verify migration files match journal
ls -la drizzle/*.sql
cat drizzle/meta/_journal.json | jq '.entries[-3:]'

# 4. Set production DATABASE_URL
export DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"

# 5. Run migrations
npm run migrate

# 6. Verify migration applied
node -e "
import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL);
const r = await sql\`SELECT COUNT(*) as count FROM drizzle.__drizzle_migrations\`;
console.log('Total migrations applied:', r[0].count);
await sql.end();
"
```

### Method 2: Manual SQL Execution (For Complex Migrations)

```bash
# 1. Connect to production database
psql $DATABASE_URL

# 2. Start transaction
BEGIN;

# 3. Run migration statements one by one
\i drizzle/00XX_migration_name.sql

# 4. Verify changes
\dt  -- Check tables
\d table_name  -- Check specific table structure

# 5. Commit or rollback
COMMIT;  -- If all looks good
-- or
ROLLBACK;  -- If something went wrong
```

### Method 3: Using the Migration Scripts

We've created helper scripts for complex scenarios:

```bash
# Mark migrations as applied without running them
# (Use when schema is already in sync via drizzle-kit push)
node scripts/fix-migration-history.js

# Apply a specific migration manually with statement-by-statement execution
node scripts/apply-job-migration.js
```

---

## Rollback Procedures

### Important: Drizzle Does NOT Support Automatic Rollbacks

You must create manual rollback scripts for each migration.

### Creating a Rollback Script

For each migration, create a corresponding rollback:

```sql
-- drizzle/rollback/00XX_migration_name_rollback.sql

-- Reverse of: CREATE TABLE new_table
DROP TABLE IF EXISTS "new_table";

-- Reverse of: ADD COLUMN
ALTER TABLE "table_name" DROP COLUMN IF EXISTS "new_column";

-- Reverse of: CREATE INDEX
DROP INDEX IF EXISTS "index_name";
```

### Emergency Rollback Procedure

```bash
# 1. Stop application servers
# 2. Connect to database
psql $DATABASE_URL

# 3. Run rollback script
\i drizzle/rollback/00XX_migration_name_rollback.sql

# 4. Remove migration from tracking table
DELETE FROM drizzle.__drizzle_migrations 
WHERE hash = 'migration_hash_here';

# 5. Restart application with previous code version
```

### Restoring from Backup

```bash
# 1. Stop all application connections
# 2. Drop and recreate database
psql -h HOST -U USER -d postgres -c "DROP DATABASE database_name;"
psql -h HOST -U USER -d postgres -c "CREATE DATABASE database_name;"

# 3. Restore backup
psql -h HOST -U USER -d database_name < backup_YYYYMMDD_HHMMSS.sql

# 4. Deploy previous application version
```

---

## Zero-Downtime Migrations

### Safe Migration Patterns

#### 1. Adding a Column (Safe ✅)
```sql
ALTER TABLE "table" ADD COLUMN "new_col" varchar(255);
```

#### 2. Adding an Index Concurrently (Safe ✅)
```sql
CREATE INDEX CONCURRENTLY "idx_name" ON "table" ("column");
```
Note: Cannot run inside a transaction.

#### 3. Dropping a Column (Two-Phase ⚠️)
```sql
-- Phase 1: Stop using column in application code
-- Deploy code changes first

-- Phase 2: After verification, drop column
ALTER TABLE "table" DROP COLUMN "old_col";
```

#### 4. Renaming a Column (Three-Phase ⚠️)
```sql
-- Phase 1: Add new column
ALTER TABLE "table" ADD COLUMN "new_name" varchar(255);

-- Phase 2: Copy data and update application
UPDATE "table" SET "new_name" = "old_name";
-- Deploy code to use both columns

-- Phase 3: After verification, drop old column
ALTER TABLE "table" DROP COLUMN "old_name";
```

#### 5. Changing Column Type (Complex ⚠️)
```sql
-- Phase 1: Add new column with new type
ALTER TABLE "table" ADD COLUMN "col_new" new_type;

-- Phase 2: Backfill data
UPDATE "table" SET "col_new" = "col_old"::new_type;

-- Phase 3: Deploy code to use new column

-- Phase 4: Drop old column, rename new
ALTER TABLE "table" DROP COLUMN "col_old";
ALTER TABLE "table" RENAME COLUMN "col_new" TO "col_old";
```

### Avoiding Table Locks

```sql
-- Set statement timeout to prevent long locks
SET statement_timeout = '5s';

-- Use CONCURRENTLY for index creation (outside transactions)
CREATE INDEX CONCURRENTLY ...

-- For large updates, batch them
UPDATE "table" SET ... WHERE id BETWEEN 1 AND 10000;
UPDATE "table" SET ... WHERE id BETWEEN 10001 AND 20000;
-- etc.
```

---

## Common Issues & Solutions

### Issue 1: Journal/File Mismatch

**Symptom:**
```
No file ./drizzle/00XX_some_name.sql found
```

**Solution:**
1. Check what files exist: `ls drizzle/*.sql`
2. Check journal: `cat drizzle/meta/_journal.json`
3. Update journal tags to match actual filenames
4. Or rename files to match journal tags

### Issue 2: Migration Already Applied

**Symptom:**
```
relation "table_name" already exists
```

**Solution:**
Mark the migration as applied without re-running:
```javascript
// scripts/mark-as-applied.js
import crypto from 'crypto';
import fs from 'fs';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);
const content = fs.readFileSync('./drizzle/00XX_migration.sql', 'utf8');
const hash = crypto.createHash('sha256').update(content).digest('hex');

await sql`
  INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  VALUES (${hash}, ${Date.now()})
`;
await sql.end();
```

### Issue 3: Extension Not Installed

**Symptom:**
```
extension "pg_trgm" is not available
```

**Solution:**
1. Check available extensions: `SELECT * FROM pg_available_extensions;`
2. Install as superuser or request from DBA
3. For managed databases (Supabase, RDS), use console to enable

### Issue 4: Foreign Key Constraint Violation

**Symptom:**
```
cannot drop table "table" because other objects depend on it
```

**Solution:**
Drop dependent objects first, or use CASCADE (carefully!):
```sql
DROP TABLE "table" CASCADE;  -- Careful: drops dependent objects!
```

---

## Best Practices

### 1. Version Control Everything
```bash
# Always commit migration files
git add drizzle/
git commit -m "Add migration: description"
```

### 2. Use Descriptive Migration Names
```bash
# Good
0011_job_matching_system.sql
0012_add_user_preferences.sql

# Bad  
0011_update.sql
0012_fix.sql
```

### 3. One Logical Change Per Migration
- Don't combine unrelated schema changes
- Makes rollback easier
- Easier to understand history

### 4. Always Add IF NOT EXISTS / IF EXISTS
```sql
CREATE TABLE IF NOT EXISTS "table" ...
CREATE INDEX IF NOT EXISTS "index" ...
DROP TABLE IF EXISTS "table" ...
```

### 5. Test Migrations Are Idempotent
Run migration twice - second run should not error.

### 6. Include Statement Breakpoints
```sql
CREATE TABLE ...;
--> statement-breakpoint
CREATE INDEX ...;
--> statement-breakpoint
```

### 7. Document Complex Migrations
```sql
-- Migration: Add job matching system
-- Author: Team
-- Date: 2025-01-26
-- 
-- This migration:
-- 1. Creates 4 new tables for job matching
-- 2. Adds columns to resume_rewrites for job-aware rewrites
-- 3. Requires pg_trgm extension for fuzzy search
--
-- Rollback: See drizzle/rollback/0011_rollback.sql
```

### 8. Keep Backups
```bash
# Automated backup before migration
pg_dump $DATABASE_URL > backup_pre_migration_$(date +%Y%m%d).sql
npm run migrate
```

### 9. Monitor Migration Progress
```sql
-- Check current connections and queries
SELECT pid, state, query, query_start 
FROM pg_stat_activity 
WHERE state != 'idle';
```

### 10. Use Staging Environment
Always test migrations on staging with production-like data before production deployment.

---

## Migration Commands Reference

```bash
# Generate new migration from schema changes
npm run generate

# Apply pending migrations
npm run migrate

# Push schema directly (development only!)
npm run push

# Open Drizzle Studio
npm run studio

# Check migration status
node scripts/check-migration-status.js
```

---

## Support Scripts

The following scripts are available in `scripts/`:

| Script | Purpose |
|--------|---------|
| `fix-migration-history.js` | Mark migrations as applied |
| `apply-job-migration.js` | Apply migrations with statement-by-statement logging |
| `check-pending-migrations.js` | Check what migrations need to be applied |
| `remove-failed-migration.js` | Remove a failed migration from tracking |

---

## Emergency Contacts

For production database issues:
1. Check application logs
2. Check database connection status
3. Review recent migrations
4. Escalate to DBA team if needed
