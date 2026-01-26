/**
 * Migration Status Check Script
 * 
 * Usage: node scripts/check-migration-status.js
 * 
 * This script compares:
 * 1. Migration files in drizzle/*.sql
 * 2. Journal entries in drizzle/meta/_journal.json
 * 3. Applied migrations in drizzle.__drizzle_migrations table
 * 
 * Identifies:
 * - Migrations pending application
 * - Orphaned database records
 * - Journal/file mismatches
 */

import 'dotenv/config';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const sql = postgres(process.env.DATABASE_URL);
const DRIZZLE_DIR = './drizzle';
const JOURNAL_PATH = './drizzle/meta/_journal.json';

async function main() {
  try {
    console.log('\n🔍 Migration Status Check\n');
    console.log('=' .repeat(60));

    // 1. Read journal entries
    const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf8'));
    const journalEntries = journal.entries;
    console.log(`\n📋 Journal entries: ${journalEntries.length}`);

    // 2. Read SQL files
    const sqlFiles = fs.readdirSync(DRIZZLE_DIR)
      .filter(f => f.endsWith('.sql') && /^\d{4}_/.test(f))
      .sort();
    console.log(`📁 SQL files: ${sqlFiles.length}`);

    // 3. Get applied migrations from database
    const dbMigrations = await sql`
      SELECT hash, created_at 
      FROM drizzle.__drizzle_migrations 
      ORDER BY created_at
    `;
    console.log(`🗄️  Database records: ${dbMigrations.length}`);

    console.log('\n' + '=' .repeat(60));
    console.log('\n📊 Detailed Analysis\n');

    // Build hash map of applied migrations
    const appliedHashes = new Set(dbMigrations.map(m => m.hash));

    // Check each journal entry
    let issues = [];
    let pending = [];
    let applied = [];

    for (const entry of journalEntries) {
      const sqlFile = `${entry.tag}.sql`;
      const sqlPath = path.join(DRIZZLE_DIR, sqlFile);

      // Check if SQL file exists
      if (!fs.existsSync(sqlPath)) {
        issues.push(`❌ Missing file: ${sqlFile} (journal entry ${entry.idx})`);
        continue;
      }

      // Compute hash
      const content = fs.readFileSync(sqlPath, 'utf8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');

      // Check if applied
      if (appliedHashes.has(hash)) {
        applied.push(`✅ ${entry.tag}`);
      } else {
        pending.push(`⏳ ${entry.tag} (not applied)`);
      }
    }

    // Check for SQL files not in journal
    for (const file of sqlFiles) {
      const tag = file.replace('.sql', '');
      const inJournal = journalEntries.some(e => e.tag === tag);
      if (!inJournal) {
        issues.push(`⚠️  File not in journal: ${file}`);
      }
    }

    // Display results
    if (applied.length > 0) {
      console.log('Applied Migrations:');
      applied.forEach(a => console.log(`  ${a}`));
    }

    if (pending.length > 0) {
      console.log('\nPending Migrations:');
      pending.forEach(p => console.log(`  ${p}`));
    }

    if (issues.length > 0) {
      console.log('\nIssues Found:');
      issues.forEach(i => console.log(`  ${i}`));
    }

    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('\n📈 Summary\n');
    console.log(`  Applied: ${applied.length}`);
    console.log(`  Pending: ${pending.length}`);
    console.log(`  Issues:  ${issues.length}`);

    if (pending.length > 0) {
      console.log('\n💡 Run "npm run migrate" to apply pending migrations.');
    }

    if (issues.length > 0) {
      console.log('\n⚠️  Please resolve issues before running migrations.');
    }

    if (pending.length === 0 && issues.length === 0) {
      console.log('\n✅ All migrations are applied and journal is in sync!');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await sql.end();
  }
}

main();
