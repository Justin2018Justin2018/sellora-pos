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

Run, in order, in the Supabase SQL Editor:
1. `supabase-schema.sql`
2. `supabase-schema-v2-security-fix.sql`
3. `supabase-schema-v3-claim-shop-fix.sql`



## Cyber Print Monitor (added)
* Run `supabase-schema-v4-cyber-print-monitor.sql` once (after v1–v3). Cyber-only, enforced by RLS (`is_cyber_member`).
* Sidebar (Cyber business only): Print Monitor, Print History, Print Report.
* Windows agent: see `print-agent/README.md`.
