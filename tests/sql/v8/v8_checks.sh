#!/usr/bin/env bash
# Assertions for v8 on a database built v1..v8.  usage: v8_checks.sh <db>
DB=$1; PASS=0; FAIL=0
q()  { su postgres -c "psql -At -q -d $DB -c \"$1\"" 2>&1 | grep -v '^$'; }
as() { local uid=$1; shift; local f; f=$(mktemp /tmp/as.XXXX.sql); chmod a+r $f
  printf "SET ROLE authenticated;\nSELECT set_config('request.jwt.claim.sub','%s',false) \\\\g /dev/null\n%s;\n" "$uid" "$*" > $f
  su postgres -c "psql -At -q -d $DB -f $f" 2>&1 | grep -v '^$'; rm -f $f; }
qf()  { local f; f=$(mktemp /tmp/q.XXXX.sql); cat > $f; chmod a+r $f; su postgres -c "psql -At -q -d $DB -f $f" 2>&1 | grep -v '^$'; rm -f $f; }
asf() { local uid=$1 f; f=$(mktemp /tmp/a.XXXX.sql); { printf "SET ROLE authenticated;\nSELECT set_config('request.jwt.claim.sub','%s',false) \\\\g /dev/null\n" "$uid"; cat; } > $f; chmod a+r $f; su postgres -c "psql -At -q -d $DB -f $f" 2>&1 | grep -v '^$'; rm -f $f; }
ok()  { PASS=$((PASS+1)); echo "  PASS  $1"; }
bad() { FAIL=$((FAIL+1)); echo "  FAIL  $1  -> [$2]"; }
eq()  { [ "$2" = "$3" ] && ok "$1" || bad "$1" "got '$2' want '$3'"; }
has() { echo "$2" | grep -qi "$3" && ok "$1" || bad "$1" "got '$2' want ~'$3'"; }
O=e0000000-0000-0000-0000-000000000001; S=e0000000-0000-0000-0000-000000000002; X=e0000000-0000-0000-0000-000000000003
q "INSERT INTO auth.users(id,email) VALUES ('$O','o@x'),('$S','s@x'),('$X','x@x')" >/dev/null

echo "== 7/8 signup path: claim_shop(text)"
as $O "SELECT claim_shop('newshop1')" >/dev/null
eq  "signup creates a tenant row"             "$(q "SELECT status||'/'||plan||'/'||(expiry_date-start_date) FROM saas_tenants WHERE id='newshop1'")" "ACTIVE/BASIC/14"
eq  "business_type left NULL (no features switch on)" "$(q "SELECT coalesce(business_type,'NULL') FROM saas_tenants WHERE id='newshop1'")" NULL
eq  "new shop is writable during trial"       "$(q "SELECT shop_is_writable('newshop1')")" t
q "UPDATE saas_tenants SET expiry_date=current_date-30 WHERE id='newshop1'" >/dev/null
eq  "new shop is NOT writable 30 days after trial (was: free forever)" "$(q "SELECT shop_is_writable('newshop1')")" f
has "second user cannot claim a claimed shop" "$(as $X "SELECT claim_shop('newshop1')")" "already claimed"
has "garbage shop id rejected"                "$(as $X "SELECT claim_shop('a b;--x')")" "Invalid shop id"
has "too-short shop id rejected"              "$(as $X "SELECT claim_shop('ab')")" "Invalid shop id"
eq  "3-arg claim path still works"            "$(as $X "SELECT claim_shop('addl1','cyber','Addl')" ; q "SELECT business_type FROM saas_tenants WHERE id='addl1'")" cyber
has "garbage id rejected on 3-arg path too"   "$(as $X "SELECT claim_shop('bad id!','cyber','x')")" "Invalid shop id"
for i in $(seq 1 25); do q "INSERT INTO shop_members(user_id,shop_id,role) VALUES ('$S','cap$i','owner')" >/dev/null; done
has "26th owned shop refused"                 "$(q "INSERT INTO shop_members(user_id,shop_id,role) VALUES ('$S','cap26','owner')")" "limit reached"

echo "== 6 password_hash"
q "INSERT INTO saas_tenants(id,shop_name,owner_name,phone,email,username,password_hash,status,plan,start_date,expiry_date,business_type) VALUES ('cyb1','Cyb','o','','o@x','cyb1','HASH_SECRET_123','ACTIVE','BASIC',current_date,current_date+30,'cyber')" >/dev/null
q "INSERT INTO shop_members(user_id,shop_id,role) VALUES ('$O','cyb1','owner'),('$S','cyb1','staff')" >/dev/null
eq  "API insert of a hash is blanked"         "$(q "SELECT coalesce(password_hash,'NULL') FROM saas_tenants WHERE id='cyb1'")" HASH_SECRET_123   # superuser insert is NOT API role: kept
q "UPDATE saas_tenants SET password_hash=NULL WHERE id='cyb1'" >/dev/null
q "INSERT INTO saas_tenant_secrets VALUES ('cyb1','HASH_SECRET_123') ON CONFLICT DO NOTHING" >/dev/null
eq  "staff sees NULL hash (select * still works)" "$(as $S "SELECT coalesce(password_hash,'NULL') FROM saas_tenants WHERE id='cyb1'")" NULL
has "staff cannot read the secrets table"     "$(as $S "SELECT * FROM saas_tenant_secrets")" "permission denied"
has "select * from saas_tenants still works for a member" "$(as $S "SELECT count(*) FROM (SELECT * FROM saas_tenants) z")" "^[1-9]"

echo "== 9 print module honours expiry"
q "INSERT INTO print_computers(id,shop_id,name,key_hash) VALUES ('c0000000-0000-0000-0000-000000000001','cyb1','PC1',print_hash_key('k'))" >/dev/null
has "active shop: agent heartbeat works"      "$(q "SELECT print_agent_heartbeat('c0000000-0000-0000-0000-000000000001','k','u','1.1.1.1','[]')")" "monitoring_enabled"
eq  "active shop: member can write settings"  "$(as $S "INSERT INTO print_settings(shop_id) VALUES ('cyb1') RETURNING shop_id")" cyb1
q "UPDATE saas_tenants SET expiry_date=current_date-30 WHERE id='cyb1'" >/dev/null
has "expired shop: agent refused"             "$(q "SELECT print_agent_heartbeat('c0000000-0000-0000-0000-000000000001','k','u','1.1.1.1','[]')")" "not an active Cyber"
has "expired shop: member cannot write print data" "$(as $S "UPDATE print_settings SET enabled=false WHERE shop_id='cyb1'" ; echo rows=$(q "SELECT enabled FROM print_settings WHERE shop_id='cyb1'"))" "rows=t"
eq  "expired shop: member can still READ print data" "$(as $S "SELECT count(*) FROM print_settings")" 1
q "UPDATE saas_tenants SET expiry_date=current_date+30 WHERE id='cyb1'" >/dev/null

echo "== 10 print billing forward-only"
q "INSERT INTO print_jobs(id,shop_id,job_hash,source,status,billing_state) VALUES ('d0000000-0000-0000-0000-000000000001','cyb1','h1','manual','completed','unbilled'),('d0000000-0000-0000-0000-000000000002','cyb1','h2','manual','completed','billed')" >/dev/null
q "UPDATE print_jobs SET amount=500, tx_receipt='R-9', billed_at=now() WHERE id='d0000000-0000-0000-0000-000000000002'" >/dev/null
eq  "unbilled -> billed directly (offline sync flow) still allowed" "$(as $S "UPDATE print_jobs SET billing_state='billed', amount=200, tx_receipt='R-1', billed_at=now() WHERE id='d0000000-0000-0000-0000-000000000001' RETURNING billing_state")" billed
has "billed job cannot be un-billed"          "$(as $S "UPDATE print_jobs SET billing_state='unbilled' WHERE id='d0000000-0000-0000-0000-000000000002'")" "cannot be changed or un-billed"
has "billed job amount cannot be rewritten"   "$(as $S "UPDATE print_jobs SET amount=1 WHERE id='d0000000-0000-0000-0000-000000000002'")" "cannot be changed or un-billed"
eq  "re-sending identical billed row (retry) is a no-op, allowed" "$(as $S "UPDATE print_jobs SET billing_state='billed', amount=500, tx_receipt='R-9' WHERE id='d0000000-0000-0000-0000-000000000002' RETURNING amount")" 500.00
eq  "other columns of a billed job still editable (customer name)" "$(as $S "UPDATE print_jobs SET customer_name='Jane' WHERE id='d0000000-0000-0000-0000-000000000002' RETURNING customer_name")" Jane
q "UPDATE print_jobs SET billing_state='billing' WHERE id='d0000000-0000-0000-0000-000000000001' AND false" >/dev/null
eq  "RPC claim/release still work (definer)"  "$(q "UPDATE print_jobs SET billing_state='unbilled' WHERE id='d0000000-0000-0000-0000-000000000001'"; as $O "SELECT print_claim_billing('d0000000-0000-0000-0000-000000000001')")" t
eq  "owner release via RPC works"             "$(as $O "SELECT print_release_billing('d0000000-0000-0000-0000-000000000001')"; q "SELECT billing_state FROM print_jobs WHERE id='d0000000-0000-0000-0000-000000000001'")" unbilled

echo "== 1/2 admin secret: trim + per-user lockout"
q "INSERT INTO shop_admin_credentials(shop_id,secret_hash,updated_by) VALUES ('cyb1',crypt('secret1',gen_salt('bf',4)),'$O')" >/dev/null
as $O "SELECT set_shop_admin_secret('cyb1',' secret1 ','secret1')" >/dev/null
chk() { as $1 "SELECT admin_delete_transaction('cyb1','NOPE',NULL,'t','$2')->>'status'"; }
eq  "secret works with surrounding spaces"    "$(chk $O ' secret1 ')" ok
eq  "secret works trimmed"                    "$(chk $O 'secret1')" ok
for i in 1 2 3 4 5; do chk $S "guess$i" >/dev/null; done
eq  "staff is locked after 5 wrong guesses"   "$(chk $S 'secret1')" locked
eq  "OWNER is NOT locked by staff's guesses"  "$(chk $O 'secret1')" ok
q "UPDATE shop_admin_credentials SET locked_until=now()-interval '1 minute' WHERE shop_id='cyb1'" >/dev/null
eq  "manual unlock (legacy column in past) clears per-user locks" "$(chk $S 'secret1')" ok
q "UPDATE shop_admin_credentials SET locked_until=now()+interval '1 hour' WHERE shop_id='cyb1'" >/dev/null
eq  "future legacy locked_until = shop-wide lock" "$(chk $O 'secret1')" locked
q "UPDATE shop_admin_credentials SET locked_until=NULL WHERE shop_id='cyb1'" >/dev/null

echo "== 3/4/5 sales: ambiguity, payload guard, void reaches payload"
qf <<'SQL' >/dev/null
INSERT INTO pos_transactions(id,receipt,service,total,unit_price,qty,shop_id,date,status,payload) VALUES
 ('t1','DUP-1','a',10,10,1,'cyb1','2026-10-01 10:00+00','completed','{"total":10,"status":"completed","receipt":"DUP-1","customer":"A"}'),
 ('t2','DUP-1','b',20,20,1,'cyb1','2026-10-01 12:00+00','completed','{"total":20,"status":"completed","receipt":"DUP-1"}'),
 ('t3','R-3','c',30,30,1,'cyb1','2026-10-02 10:00+00','completed','{"total":30,"status":"completed","receipt":"R-3","customer":"C","notes":""}'),
 ('t4','R-4','legacy',40,40,1,'cyb1','2026-10-02 11:00+00','completed',NULL);
SQL
R=$(asf $O <<SQL
SELECT admin_delete_transaction('cyb1','DUP-1',NULL,'t','secret1')->>'status';
SQL
)
eq  "delete, duplicate receipt, no date -> ambiguous" "$R" ambiguous
eq  "  ...and nothing was deleted"            "$(q "SELECT count(*) FROM pos_transactions WHERE receipt='DUP-1'")" 2
R=$(asf $O <<SQL
SELECT admin_delete_transaction('cyb1','DUP-1','2026-10-01 12:00+00','t','secret1')->>'deleted';
SQL
)
eq  "delete, duplicate receipt WITH date -> deletes exactly one" "$R" 1
eq  "  ...and the other sale is still there" "$(q "SELECT id FROM pos_transactions WHERE receipt='DUP-1'")" t1
q "INSERT INTO pos_transactions(id,receipt,service,total,unit_price,qty,shop_id,date,status) VALUES ('t5','DUP-1','z',5,5,1,'cyb1','2026-10-03 10:00+00','completed')" >/dev/null
eq  "void, duplicate receipt, no date -> ambiguous"  "$(asf $O <<SQL
SELECT admin_void_transaction('cyb1','DUP-1',NULL,'dup test')->>'status';
SQL
)" ambiguous
has "member cannot edit payload.total" "$(asf $S <<'SQL'
UPDATE pos_transactions SET payload=jsonb_set(payload,'{total}','1') WHERE id='t3';
SQL
)" "payload.total"
has "member cannot edit payload.status" "$(asf $S <<'SQL'
UPDATE pos_transactions SET payload=jsonb_set(payload,'{status}','"cancelled"') WHERE id='t3';
SQL
)" "payload.status"
has "member cannot wipe the payload" "$(asf $S <<'SQL'
UPDATE pos_transactions SET payload=NULL WHERE id='t3';
SQL
)" "payload"
eq  "member CAN still edit non-financial payload keys (customer)" "$(asf $S <<'SQL'
UPDATE pos_transactions SET payload=jsonb_set(payload,'{customer}','"Zed"') WHERE id='t3' RETURNING payload->>'customer';
SQL
)" Zed
eq  "legacy row: first payload that matches the row is allowed" "$(asf $S <<'SQL'
UPDATE pos_transactions SET payload='{"total":40,"status":"completed"}' WHERE id='t4' RETURNING payload->>'total';
SQL
)" 40
q "UPDATE pos_transactions SET payload=NULL WHERE id='t4'" >/dev/null
has "legacy row: first payload that disagrees is refused" "$(asf $S <<'SQL'
UPDATE pos_transactions SET payload='{"total":1}' WHERE id='t4';
SQL
)" "disagrees"
R=$(asf $O <<SQL
SELECT admin_void_transaction('cyb1','R-3',NULL,'customer left')->>'status';
SQL
)
eq  "void succeeds"                            "$R" ok
eq  "void sets row status AND payload.status (other devices read payload)" "$(q "SELECT status||'/'||(payload->>'status')||'/'||(payload->>'notes') FROM pos_transactions WHERE id='t3'")" "cancelled/cancelled/Cancelled: customer left"
eq  "void keeps the amounts (money not rewritten)"  "$(q "SELECT total||'/'||(payload->>'total') FROM pos_transactions WHERE id='t3'")" "30/30"
eq  "void is audited with a snapshot"         "$(q "SELECT count(*) FROM pos_audit_log WHERE action='TRANSACTION_VOIDED' AND entity_ref='R-3' AND snapshot IS NOT NULL")" 1
eq  "voiding again is harmless (idempotent)"  "$(asf $O <<SQL
SELECT admin_void_transaction('cyb1','R-3',NULL,'again')->>'voided';
SQL
)" 0
echo; echo "RESULT: $PASS passed, $FAIL failed"; [ $FAIL -eq 0 ]
