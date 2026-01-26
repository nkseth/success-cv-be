# Database Scripts

This directory contains utility scripts for database operations.

## Scripts

### verify-optimizations.js
Verifies that all database optimizations from migration 0014 are properly applied.

**Usage:**
```bash
node scripts/verify-optimizations.js
```

**Checks:**
- ✅ Partial indexes (4 expected)
- ✅ Full-text search setup (column, index, trigger)
- ✅ Composite indexes (9 expected)
- ✅ Monitoring functions (5 functions)
- ✅ Quick function tests
- ✅ Index statistics

---

### test-blank-resume.js
Tests the "Create from Scratch" feature (POST /resumes/blank endpoint).

**Usage:**
```bash
AUTH_TOKEN=your_token node scripts/test-blank-resume.js
```

**Environment Variables:**
- `AUTH_TOKEN` (required): Valid authentication token
- `API_URL` (optional): API base URL (default: http://localhost:3000)

**Tests:**
- ✅ Create blank resume without name
- ✅ Create blank resume with custom name
- ✅ Verify required fields
- ✅ Verify isDraft status
- ✅ Validate input constraints

---

### check-migration-status.js
Checks the status of all database migrations and verifies synchronization.

**Usage:**
```bash
npm run migrate:status
# or
node scripts/check-migration-status.js
```

**Output:**
- Journal entries count
- SQL files count
- Database records count
- List of applied migrations
- List of pending migrations
- Detected issues (if any)

---

### run-seed.js
Seeds the database with initial data.

**Usage:**
```bash
node run-seed.js
```

---

## Related Documentation

- [DATABASE_MIGRATION_GUIDE.md](../docs/DATABASE_MIGRATION_GUIDE.md) - Production migration procedures
- [DATABASE_OPTIMIZATION.md](../docs/DATABASE_OPTIMIZATION.md) - Index strategy and recommendations
- [DATABASE_MONITORING.md](../docs/DATABASE_MONITORING.md) - Monitoring functions reference
- [DATABASE_OPTIMIZATION_SUMMARY.md](../docs/DATABASE_OPTIMIZATION_SUMMARY.md) - Implementation summary

---

## Common Commands

```bash
# Check migration status
npm run migrate:status

# Apply pending migrations
npm run migrate

# Verify optimizations
node scripts/verify-optimizations.js

# Test monitoring functions (requires DATABASE_URL)
node -e "import('postgres').then(m => {
  const sql = m.default(process.env.DATABASE_URL);
  sql\`SELECT * FROM cache_hit_ratio()\`.then(console.log).finally(() => sql.end());
})"
```

---

## Environment Variables Required

All scripts require:
- `DATABASE_URL`: PostgreSQL connection string

Example `.env`:
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
```
