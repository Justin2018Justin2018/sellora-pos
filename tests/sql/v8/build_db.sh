#!/usr/bin/env bash
# usage: build_db.sh <db> [last-file-to-include-glob...]   Builds v1..vN on the shim. Starts PostgreSQL if it is down.
DB=$1; shift; R="$(cd "$(dirname "$0")/../../.." && pwd)"
(service postgresql status | grep -q online) || { service postgresql start >/dev/null 2>&1; sleep 4; }
su postgres -c "psql -q -c 'DROP DATABASE IF EXISTS $DB'" 2>/dev/null; su postgres -c "psql -q -c 'CREATE DATABASE $DB'"
FILES="tests/sql/supabase_shim.sql supabase-schema.sql supabase-schema-v2-security-fix.sql supabase-schema-v3-claim-shop-fix.sql supabase-schema-v3b-reconcile.sql supabase-schema-v4-cyber-print-monitor.sql supabase-schema-v5-hardening.sql supabase-schema-v6-admin-authorization.sql supabase-schema-v7-void-transaction.sql $*"
for f in $FILES; do su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -f $R/$f" >/tmp/b.log 2>&1 || { echo "BUILD FAILED at $f"; tail -5 /tmp/b.log; exit 1; }; done; echo "built $DB: $FILES" | cut -c1-60
