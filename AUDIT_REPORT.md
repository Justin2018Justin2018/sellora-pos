# Sellora POS - Audit & Hardening Report (first pass)

**Scope honesty first.** This environment could not install npm packages (registry returned 403) and had no
Postgres/Supabase access. So: `npm ci`, `vite build`, a clean `tsc`, browser/UI tests and every SQL file were **not
executed**. What *was* run: 24 unit tests (pass) and a before/after TypeScript diff. Nothing below is claimed as
verified unless it says so. This is **not** a production-ready sign-off.

## A. Executive summary
The security model was started correctly (v2 moved data to shop-scoped, authenticated RLS; real Supabase Auth exists)
but is incomplete in four ways: (1) staff/admin authorisation is client-side with default and plaintext passwords,
(2) the repo SQL and the live database have drifted, so the code references objects no SQL file creates, (3) the
"offline-first" layer is wired for **sales and print jobs only**, and (4) money/receipt/idempotency handling had
confirmed defects, one of which double-counts revenue. I fixed the items I could fix safely and verify by reading or
by test; I deliberately did **not** change behaviour that would lock existing users out without your decision.

## B. Findings
Status key: **Fixed-T** = fixed and unit-tested; **Fixed-U** = changed, not executable here (needs your build/DB);
**Open** = not fixed, reason given.

| ID | Sev | Where | Defect and realistic failure | Status |
|---|---|---|---|---|
| F1 | P0 | `POSContext.tsx` 378/1167/1492, `defaultData.ts` 76/171/182/193, `saasService.ts` 166/189, `BusinessTypeSelectionModal.tsx` 133 | Admin/staff login and the "admin password" for deletes are checked in the browser against plaintext values in localStorage, with shared defaults (`admin123`, `password123`, `pass123`, `pos1234`). Anyone with the device (or devtools) is admin. The DB also lets every shop member do everything, so a cashier can bypass the UI with the API. | **Open** (changing it blind locks users out). Server-side containment added in v5: DELETE owner-only, audit append-only, family finance owner-only. Needed: per-staff Supabase accounts with `shop_members.role`, PIN verified by an RPC (pgcrypto `crypt`), no plaintext. |
| F2 | P0 | `supabase.ts` 245, `AuthContext.tsx` 108, `App.tsx` 127, `saasService.ts` ensureTenantForShop | v1-v3 give members **no** SELECT on `saas_tenants` (the policy the code cites was never created), so the "authoritative" tenant is always `null` and the gate falls back to an editable localStorage copy; with no local copy it mints a fresh 14-day trial (clear storage = new trial). No `pos_*` policy checks subscription state at all. | **Fixed-U (server)**: v3b adds member-read of own tenant row; v5 makes writes require an active subscription (+7-day grace). **Open (client)**: fallback to local tenant unchanged to avoid offline lock-out. Proposed: cache last server-verified tenant with `verifiedAt` and a defined offline grace. |
| F3 | P0 | v4 vs v1-v3 | Schema drift: `saas_tenants.business_type`, `super_admins.pin_hash`, `set_super_admin_pin`, 3-arg `claim_shop`, `pos_transactions` UUID id/`payload`/`device_id`/`synced_at` exist in code but in no SQL. A fresh DB fails at v4 and every offline sale sync fails. | **Fixed-U**: `supabase-schema-v3b-reconcile.sql` (the 3-arg `claim_shop` is a *reconstruction* created only if absent). |
| F4 | P0 | `supabase.ts` fetchTransactionsFromSupabase, `POSContext.tsx` pull effect | Queue-synced sales have UUID ids; `Number(uuid)` is `NaN`, so de-dup by id never matches and **each synced sale is re-added to local state on every load, double-counting revenue and profit**. | **Fixed-U**: ids mapped from `payload`/stable hash; pull de-duplicates by receipt too. |
| F5 | P0 | v3 `claim_shop` | Check-then-insert race: two simultaneous first claims can create two owners. | **Fixed-U**: advisory lock + partial unique index `uq_shop_members_one_owner` (works even if the deployed function body differs). |
| F6 | P0* | `supabase-schema.sql` | v1 created `USING (true)` policies for anon on every private table; re-running v1 on a secured DB re-opens it. (*P0 only if the live DB still has them: run audit query 2.) | **Fixed-U**: v1 is now deny-by-default; v5 revokes anon table privileges. |
| F7 | P1 | `POSContext.tsx` (5 sites) | Receipt = `list.length + 1`: reused after any deletion; collides across devices. | **Fixed-T** for same-device reuse (`src/utils/receipt.ts`). **Decision needed** for multi-device (below). |
| F8 | P1 | `POSContext.tsx`, `syncEngine.ts` | Only `sale` and `printJob` are ever enqueued. Debts, **debt repayments**, expenses, customers, stock movements never sync; stock is not a movement ledger; pushers spread app-shaped payloads into DB columns. | **Open** (not implemented, not claimed). Pushers now at least set `shop_id` (previously the DB default `'shop_1'`). |
| F9 | P1 | `syncEngine.ts` | Entries stuck in `syncing` after a tab close were never retried; overlapping runs; permanent errors retried silently forever; `DELETE`/`UPDATE` queue ops were executed as upserts. | **Fixed-T** (policy) / **Fixed-U** (engine wiring; Dexie not runnable here). |
| F10 | P1 | `POSContext.tsx` deleteTransaction | A sale deleted while still queued was later pushed to the cloud (resurrection); cloud delete used the numeric id, which never matches UUID rows. | **Fixed-U**: purge from offline store/queue; cloud delete scoped by shop + receipt (+date). |
| F11 | P1 | `recordCyberSale`, `recordDebtPayment` | No double-submit guard; debt payment validated against a stale closure (double click pays twice); float arithmetic (`0.1+0.2`), `NaN` when `original = 0`. | **Fixed-T** (money helpers) / **Fixed-U** (wiring). Gas, electronics, general-sale paths not yet guarded. |
| F12 | P1 | `syncTransactionToSupabase` | Manual "Sync now" re-pushed sales under a numeric id while the queue used a UUID: duplicate cloud rows. | **Fixed-U**: skips if (shop, receipt) already exists. |
| F13 | P1 | architecture | Sales/stock/debts live in React state + localStorage with a cloud mirror; multi-table financial changes are not atomic and stock deduction is not server-validated. | **Open**: needs server RPCs (`record_sale`, `apply_debt_payment`) with idempotency keys and a stock-movements table. Not started; no consumer exists in the client yet. |
| F14 | P2 | `types/pos.ts` | `discount` missing from `Transaction`: original `npm run lint` fails (3 TS2353). | **Fixed** (TS errors 3 -> 0 in diff). |
| F15 | P2 | `.env.example` | `VITE_SUPERADMIN_PASSWORD_HASH` ships an unsalted SHA-256 in the public bundle. | **Open**: leave it blank (DB-backed path exists). |
| F16 | P2 | v1 schema | `pos_*` primary key is `id` alone, not `(shop_id, id)`. | **Open**: low risk with UUID ids; legacy `Date.now()` ids can collide across shops. |
| F17 | P2 | `POSContext.tsx` | 2.8k-line context. | **Open** by design (no refactor without tests). |
| F18 | P2 | `GAS-` prefix | Gas refills and general sales share the `GAS-` stem (separate lists). | **Open**. |
| F19 | P2 | super-admin PIN | Unsalted SHA-256 of a >=6-char PIN. Gate is server-side RLS, PIN is UI-only. | **Open**. |

## C. Data-integrity notes
Money: new `src/utils/money.ts` (integer minor units). Used for debt repayment only so far; other
`toFixed`/float sites in the 2.8k-line context are untouched. Stored amounts, pricing and plan prices are unchanged.

## D. Database changes (nothing executed)
`supabase-schema-v3b-reconcile.sql`, `supabase-schema-v5-hardening.sql`, `supabase-audit-queries.sql` (read-only),
`tests/sql/rls_isolation_checks.sql` (rolls back). v5 is non-destructive; CHECK constraints are `NOT VALID`, so
existing/imported rows are never rejected. `pos_transactions.id` BIGINT -> TEXT preserves values.
Order: v1, v2, v3, v3b, v4, v5. Optional unique receipt index is **opt-in** (explained in v5 section 4).

## E. Source changes
`src/utils/money.ts`, `src/utils/receipt.ts`, `src/services/syncPolicy.ts` (new); `syncEngine.ts`, `offlineDb.ts`,
`supabase.ts`, `POSContext.tsx`, `types/pos.ts`; `package.json` (`test` script only, no new dependency).

## F. Test results (actually executed)
| Command | Result |
|---|---|
| `npm ci` | **failed**: registry 403 in this sandbox |
| `node --test "tests/**/*.test.ts"` | **24 pass, 0 fail** (money 8, receipt 10, sync policy 6) |
| `tsc --noEmit -p .` (global tsc, deps missing) | not clean (9.3k errors from absent type packages, same before/after); diff vs baseline: no syntax errors, `discount` errors fixed, remainder are the same missing-types noise |
| `vite build`, UI, Dexie queue, any SQL | **not run** |

## G. Deployment
Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` only (anon key is public by design; never ship a service-role key).
Leave `VITE_SUPERADMIN_*` blank. Steps: README "Database setup", then `npm ci && npm test && npm run build`.
Offline subscription policy implemented in SQL: lapsed shops keep read access and local use; server accepts writes
for 7 days after `expiry_date`; queued jobs show as blocked until renewal.

## H. Decisions I need from you
1. **Receipt format for multi-device shops.** Keep `MJRC-YYYYMMDD-00347` (collisions possible across offline devices)
   or append a device tag (`...-00347-A3F`, already implemented in `receipt.ts`, not enabled)? Imported historical
   receipts are unaffected either way. Unique-per-shop receipts should only be enabled after this.
2. **Staff authentication redesign (F1).** Per-staff Supabase accounts + server-verified PIN is the secure path but
   changes how cashiers sign in.
3. **Subscription offline grace (F2 client side)**: proposed 7 days, same as the server grace.

## I. Remaining risk / readiness
Not ready for commercial deployment. Blocking: F1, F8, F13, and the unverified status of v3b/v5 and the client changes.
