#!/usr/bin/env bash
# Rebuilds a scratch database from v1..v5 on a local PostgreSQL and runs every tests/sql/*_checks.sql file.
# Usage: PGHOST=/var/tmp/pgtest PGPORT=54329 PGUSER=postgres tests/sql/run_sql_tests.sh
set -u
cd "$(dirname "$0")/../.."
DB=${SELLORA_TEST_DB:-sellora_sqltest}
P="psql -X -q -v ON_ERROR_STOP=1"
psql -X -q -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB" || exit 2
$P -d $DB -f tests/sql/supabase_shim.sql || exit 2
for f in supabase-schema.sql supabase-schema-v2-security-fix.sql supabase-schema-v3-claim-shop-fix.sql \
         supabase-schema-v3b-reconcile.sql supabase-schema-v4-cyber-print-monitor.sql supabase-schema-v5-hardening.sql \
         $(ls supabase-schema-v6*.sql supabase-schema-v7*.sql 2>/dev/null); do
  echo "apply $f"; $P -d $DB -f "$f" > /dev/null || { echo "MIGRATION FAILED: $f"; exit 1; }
done
rc=0
for t in tests/sql/*_checks.sql; do
  echo "run $t"; out=$($P -d $DB -f "$t" 2>&1); s=$?
  echo "$out" | grep -E "NOTICE|ERROR|FAIL" ; [ $s -ne 0 ] && { echo "FAILED: $t"; rc=1; }
done
[ $rc -eq 0 ] && echo "ALL SQL CHECKS PASSED" || echo "SQL CHECKS FAILED"
exit $rc
