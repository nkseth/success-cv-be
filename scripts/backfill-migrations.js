import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import postgres from 'postgres';

const journal = JSON.parse(fs.readFileSync('./drizzle/meta/_journal.json', 'utf8'));
const sql = postgres(process.env.DATABASE_URL);

// Only backfill migrations 0000–0015 (already applied to DB, just not tracked)
const toBackfill = journal.entries.filter(e => e.idx <= 15);

for (const entry of toBackfill) {
  const migrationPath = `./drizzle/${entry.tag}.sql`;
  if (!fs.existsSync(migrationPath)) {
    console.warn(`Skipping missing file: ${migrationPath}`);
    continue;
  }
  const content = fs.readFileSync(migrationPath, 'utf8');
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  await sql`
    INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES (${hash}, ${entry.when})
    ON CONFLICT DO NOTHING
  `;
  console.log(`✓ Marked as applied: ${entry.tag}`);
}

await sql.end();
console.log('\nDone! Now run: npx drizzle-kit migrate');
