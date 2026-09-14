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


## Multi-business isolation (v5 security hardening)

Sellora now treats `business_subscriptions` as the authoritative entitlement set. A tenant can hold multiple independent business subscriptions and switches between them one at a time. The `all` value is a bundle entitlement, not an operating mode.

Run `supabase-schema-v4-business-isolation.sql` after the existing schema migrations. The migration:
- migrates existing tenants into per-business subscription rows;
- scopes business data by `shop_id + business_type`;
- enforces active/unexpired subscriptions in Supabase RLS;
- prevents ordinary customers from manufacturing ACTIVE subscriptions from browser/devtools requests;
- provides `business_subscription_requests` for additional-business requests;
- preserves historical data when subscriptions expire/cancel.

Customer activation in a Supabase deployment must be completed by the trusted payment/backend webhook or a super admin. The browser can request a business but cannot grant itself access.

Security regression checks are in `supabase-business-isolation-tests.sql`.
