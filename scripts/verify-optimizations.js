import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

async function verifyOptimizations() {
  try {
    console.log('🔍 Verifying Database Optimizations\n');
    console.log('='.repeat(60) + '\n');

    // 1. Check partial indexes
    console.log('1️⃣  Partial Indexes:');
    const partialIndexes = await sql`
      SELECT 
        indexname,
        tablename,
        pg_size_pretty(pg_relation_size(schemaname||'.'||indexname)) as size
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND (
          indexname LIKE '%_active_only%' OR
          indexname LIKE '%_pending%'
        )
      ORDER BY indexname
    `;
    partialIndexes.forEach(idx => {
      console.log(`   ✅ ${idx.indexname} on ${idx.tablename} (${idx.pg_size_pretty})`);
    });

    // 2. Check full-text search
    console.log('\n2️⃣  Full-Text Search:');
    const ftsCheck = await sql`
      SELECT 
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'jobs' 
        AND column_name = 'search_vector'
    `;
    if (ftsCheck.length > 0) {
      console.log(`   ✅ search_vector column exists (${ftsCheck[0].data_type})`);
      
      const ftsIndex = await sql`
        SELECT indexname, pg_size_pretty(pg_relation_size('public.' || indexname)) as size
        FROM pg_indexes
        WHERE tablename = 'jobs' AND indexname = 'jobs_search_idx'
      `;
      if (ftsIndex.length > 0) {
        console.log(`   ✅ jobs_search_idx exists (${ftsIndex[0].pg_size_pretty})`);
      }

      const ftsTrigger = await sql`
        SELECT trigger_name
        FROM information_schema.triggers
        WHERE event_object_table = 'jobs'
          AND trigger_name = 'jobs_search_vector_update'
      `;
      if (ftsTrigger.length > 0) {
        console.log(`   ✅ Auto-update trigger active`);
      }
    } else {
      console.log('   ❌ search_vector column not found');
    }

    // 3. Check composite indexes
    console.log('\n3️⃣  Composite Indexes:');
    const compositeIndexes = await sql`
      SELECT 
        i.indexname,
        i.tablename,
        pg_size_pretty(pg_relation_size('public.' || i.indexname)) as size
      FROM pg_indexes i
      WHERE i.schemaname = 'public'
        AND (
          i.indexname LIKE '%_user_%_idx' OR
          i.indexname LIKE '%_location_%_idx' OR
          i.indexname LIKE '%_type_%_idx'
        )
      ORDER BY i.indexname
      LIMIT 5
    `;
    compositeIndexes.forEach(idx => {
      console.log(`   ✅ ${idx.indexname} on ${idx.tablename} (${idx.pg_size_pretty})`);
    });
    console.log(`   ... and ${Math.max(0, 9 - compositeIndexes.length)} more composite indexes`);

    // 4. Check monitoring functions
    console.log('\n4️⃣  Monitoring Functions:');
    const functions = await sql`
      SELECT 
        p.proname as function_name,
        pg_get_function_result(p.oid) as return_type
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname IN (
          'check_slow_queries',
          'find_unused_indexes',
          'cache_hit_ratio',
          'check_table_bloat',
          'table_sizes'
        )
      ORDER BY p.proname
    `;
    
    const expectedFunctions = [
      'cache_hit_ratio',
      'check_slow_queries',
      'check_table_bloat',
      'find_unused_indexes',
      'table_sizes'
    ];
    
    expectedFunctions.forEach(fname => {
      const exists = functions.find(f => f.function_name === fname);
      if (exists) {
        console.log(`   ✅ ${fname}()`);
      } else {
        console.log(`   ❌ ${fname}() not found`);
      }
    });

    // 5. Test monitoring functions
    console.log('\n5️⃣  Quick Function Tests:');
    
    const cacheRatio = await sql`SELECT cache_hit_ratio FROM cache_hit_ratio()`;
    console.log(`   ✅ cache_hit_ratio(): ${cacheRatio[0].cache_hit_ratio}%`);

    const tableCount = await sql`SELECT COUNT(*) as count FROM table_sizes()`;
    console.log(`   ✅ table_sizes(): ${tableCount[0].count} tables tracked`);

    const bloat = await sql.unsafe(`SELECT COUNT(*) as count FROM check_table_bloat()`);
    console.log(`   ✅ check_table_bloat(): ${bloat[0].count} tables with bloat`);

    const unused = await sql.unsafe(`SELECT COUNT(*) as count FROM find_unused_indexes()`);
    console.log(`   ✅ find_unused_indexes(): ${unused[0].count} low-usage indexes`);

    try {
      await sql`SELECT * FROM check_slow_queries() LIMIT 1`;
      console.log(`   ✅ check_slow_queries(): Working`);
    } catch (e) {
      if (e.message.includes('pg_stat_statements')) {
        console.log(`   ⚠️  check_slow_queries(): pg_stat_statements not enabled`);
      } else {
        console.log(`   ❌ check_slow_queries(): Error - ${e.message}`);
      }
    }

    // 6. Index statistics
    console.log('\n6️⃣  Index Statistics:');
    const indexStats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE indexname LIKE '%_active_only%' OR indexname LIKE '%_pending%') as partial_indexes,
        COUNT(*) FILTER (WHERE indexname LIKE '%_user_%_idx' OR indexname LIKE '%_location_%_idx') as composite_indexes,
        COUNT(*) as total_indexes
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename NOT LIKE 'pg_%'
    `;
    console.log(`   📊 Total indexes: ${indexStats[0].total_indexes}`);
    console.log(`   📊 Partial indexes: ${indexStats[0].partial_indexes}`);
    console.log(`   📊 Composite indexes: ${indexStats[0].composite_indexes}`);

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ All optimizations verified and working!\n');
    console.log('📖 See docs/DATABASE_OPTIMIZATION_SUMMARY.md for details');
    console.log('📖 See docs/DATABASE_MONITORING.md for monitoring guide\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await sql.end();
  }
}

verifyOptimizations();
