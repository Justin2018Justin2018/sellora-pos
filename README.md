# Sellora POS

Smart Business & Profit Management System for retail, cyber cafés, printing shops, stationery, gas and general commerce.

## Run locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and fill in your Supabase project's URL and anon key.
3. Run the app:
   `npm run dev`

## Deploy

`npm run build` produces a static `dist/` folder deployable to any static host (Vercel, Netlify, etc.). Set the same environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in your host's project settings.

## Database setup

**Fresh install** - run in the Supabase SQL Editor, in this order:
1. `supabase-schema.sql` (tables, RLS on, deny-by-default)
2. `supabase-schema-v2-security-fix.sql` (shop_members, super_admins, shop-scoped policies)
3. `supabase-schema-v3-claim-shop-fix.sql`
4. `supabase-schema-v3b-reconcile.sql` (columns/functions the app needs that v1-v3 never created)
5. `supabase-schema-v4-cyber-print-monitor.sql`
6. `supabase-schema-v5-hardening.sql` (role-scoped RLS, subscription-aware writes, money checks)

Then promote your own account once, from the SQL editor only:
`INSERT INTO super_admins (user_id, email) VALUES ('<your auth user uuid>', 'you@example.com');`

**Existing (live) database** - do NOT paste the files blindly. The live schema has drifted from these files.
1. Run `supabase-audit-queries.sql` (read-only) and review every result.
2. Apply v3b and v5 to a Supabase *branch* or staging copy first; run `tests/sql/rls_isolation_checks.sql` there.
3. Take a backup, then apply to production.

## Tests

`npm test` runs the unit tests (money arithmetic, receipt numbering, sync retry/error policy) with Node's built-in
runner (Node 22.18+; no extra dependency). `tests/sql/rls_isolation_checks.sql` is the database-level isolation test
and must be run manually against a staging database. See `AUDIT_REPORT.md` for what is and is not covered.

## Cyber Print Monitor
* Run `supabase-schema-v4-cyber-print-monitor.sql` after v1-v3b. Cyber-only, enforced by RLS (`is_cyber_member`).
* Sidebar (Cyber business only): Print Monitor, Print History, Print Report.
* Windows agent: see `print-agent/README.md`.
