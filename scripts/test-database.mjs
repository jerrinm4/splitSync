import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFile, readdir } from 'node:fs/promises'
import assert from 'node:assert/strict'

// Minimal Supabase platform schemas; every application migration runs unchanged.
const db = new PGlite({ extensions: { pgcrypto } })
try {
  await db.exec(`
    CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions;
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_user::text; $$;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean);
    CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid(), bucket_id text, name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1, '/'); $$;
    GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
    SELECT set_config('request.headers', '{}', false);
  `)
  const migrations = (await readdir('supabase/migrations')).filter(file => file.endsWith('.sql')).sort()
  for (const file of migrations) {
    try { await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8')) }
    catch (error) { throw new Error(`Migration ${file}: ${error.message}`, { cause: error }) }
  }
  const owner = '10000000-0000-4000-8000-000000000001'
  const outsider = '10000000-0000-4000-8000-000000000002'
  const admin = '10000000-0000-4000-8000-000000000003'
  const trip = '20000000-0000-4000-8000-000000000001'
  const otherTrip = '20000000-0000-4000-8000-000000000002'
  const first = '30000000-0000-4000-8000-000000000001'
  const second = '30000000-0000-4000-8000-000000000002'
  const foreign = '30000000-0000-4000-8000-000000000003'
  await db.exec(`
    INSERT INTO auth.users VALUES ('${owner}', 'owner@example.test'), ('${outsider}', 'other@example.test'), ('${admin}', 'admin@example.test');
    INSERT INTO trips (id, owner_id, name, share_enabled, share_token, share_pin)
      VALUES ('${trip}', '${owner}', 'Test', true, 'test-token', '1234'), ('${otherTrip}', '${outsider}', 'Other', false, 'other-token', NULL);
    INSERT INTO trip_admins (trip_id, user_id) VALUES ('${trip}', '${admin}');
    INSERT INTO trip_members (id, trip_id, name) VALUES ('${first}', '${trip}', 'Alice'), ('${second}', '${trip}', 'Bob'), ('${foreign}', '${otherTrip}', 'Other');
  `)
  const login = async (id, role = 'authenticated', headers = {}) => {
    await db.exec('RESET ROLE')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.headers', $2, false)", [id, JSON.stringify(headers)])
    await db.exec(`SET ROLE ${role}`)
  }
  const shares = [{ member_id: first, amount_paise: 500 }, { member_id: second, amount_paise: 500 }]
  const create = (split = shares, payers = shares, key = crypto.randomUUID()) => db.query(`SELECT create_expense(
    $1::uuid, 'Dinner', 1000::bigint, '2026-09-26'::date, 'MEMBER', NULL::uuid, 'EQUAL', '',
    $2::uuid, $3::jsonb, NULL, true, NULL, $4::jsonb) AS id`, [trip, key, JSON.stringify(split), JSON.stringify(payers)])
  await login(owner)
  const key = crypto.randomUUID()
  const id = (await create(shares, shares, key)).rows[0].id
  assert.equal((await create(shares, shares, key)).rows[0].id, id, 'create retry is idempotent')
  assert.equal((await db.query('SELECT count(*)::int AS n FROM expense_payers')).rows[0].n, 2)
  await assert.rejects(create([{ member_id: foreign, amount_paise: 1000 }]), /Members must belong/)
  await assert.rejects(create([{ member_id: first, amount_paise: 900 }]), /Shares must equal/)
  await assert.rejects(create(shares, [{ member_id: first, amount_paise: 900 }]), /Shares must equal/)
  await assert.rejects(create([{ member_id: first, amount_paise: 500 }, { member_id: first, amount_paise: 500 }]), /Duplicate/)

  const update = (version) => db.query(`SELECT update_expense($1::uuid, 'Updated dinner', 1000::bigint, '2026-09-26'::date,
    'MEMBER', NULL::uuid, 'EQUAL', '', $2::jsonb, NULL, true, NULL, $2::jsonb, $3::integer)`, [id, JSON.stringify(shares), version])
  await update(1)
  await assert.rejects(update(1), /changed by someone else/)
  await login(admin)
  await update(2)
  await login(outsider)
  assert.equal((await db.query('SELECT count(*)::int AS n FROM expense_payers')).rows[0].n, 0, 'outsiders cannot read payers')
  await assert.rejects(create(), /Access denied/)
  await assert.rejects(update(3), /Access denied/)
  await assert.rejects(db.query('INSERT INTO expense_payers(expense_id, member_id, amount_paise) VALUES ($1, $2, 1000)', [id, foreign]), /row-level security|Members must belong/)
  await login('', 'anon', { 'x-share-token': 'test-token', 'x-share-pin': 'wrong' })
  assert.equal((await db.query('SELECT count(*)::int AS n FROM expense_payers')).rows[0].n, 0)
  await login('', 'anon', { 'x-share-token': 'test-token', 'x-share-pin': '1234' })
  assert.equal((await db.query('SELECT count(*)::int AS n FROM expense_payers')).rows[0].n, 2)
  assert.equal((await db.query('DELETE FROM expenses WHERE id = $1 RETURNING id', [id])).rows.length, 0, 'shared links cannot delete')
  await assert.rejects(create(), /permission denied/)
  await login(owner)
  await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id, name) VALUES ('receipts', $1)", [`${otherTrip}/receipt.png`]), /row-level security/)
  await db.query("INSERT INTO storage.objects(bucket_id, name) VALUES ('receipts', $1)", [`${trip}/receipt.png`])
  assert.equal((await db.query("SELECT count(*)::int AS n FROM storage.objects WHERE bucket_id = 'receipts'")).rows[0].n, 1, 'owner can access receipts')
  await login(admin)
  assert.equal((await db.query("SELECT count(*)::int AS n FROM storage.objects WHERE bucket_id = 'receipts'")).rows[0].n, 1, 'co-admin can access receipts')
  await login(outsider)
  assert.equal((await db.query("SELECT count(*)::int AS n FROM storage.objects WHERE bucket_id = 'receipts'")).rows[0].n, 0, 'unrelated accounts cannot access receipts')
  await login('', 'anon', { 'x-share-token': 'test-token', 'x-share-pin': '1234' })
  assert.equal((await db.query("SELECT count(*)::int AS n FROM storage.objects WHERE bucket_id = 'receipts'")).rows[0].n, 0, 'a shared link cannot access receipts')
  await db.exec('RESET ROLE')
  assert.equal((await db.query("SELECT public FROM storage.buckets WHERE id = 'receipts'")).rows[0].public, false, 'receipt bucket is private')
  await login(owner)
  await assert.rejects(db.query('DELETE FROM trip_members WHERE id = $1', [first]), /financial history/)
  await assert.rejects(db.query('UPDATE trips SET owner_id = $1 WHERE id = $2', [admin, trip]), /ownership cannot be changed/)
  await assert.rejects(db.query('SELECT add_funds($1::uuid, $2::uuid, 5000::bigint, $3::text, $4::uuid)', [trip, foreign, '', crypto.randomUUID()]), /Members must belong/)
  await db.query('SELECT add_funds($1::uuid, $2::uuid, 5000::bigint, $3::text, $4::uuid)', [trip, first, '', crypto.randomUUID()])
  const refundKey = crypto.randomUUID()
  const refund = (amount, key = refundKey) => db.query('SELECT remove_funds($1::uuid, $2::uuid, $3::bigint, $4::text, $5::uuid) AS id', [trip, first, amount, '', key])
  const refundId = (await refund(1000)).rows[0].id
  assert.equal((await refund(1000)).rows[0].id, refundId, 'refund retry is idempotent')
  await assert.rejects(refund(4001, crypto.randomUUID()), /Insufficient funds/)
  await assert.rejects(refund(-1, crypto.randomUUID()), /Invalid amount/)
  await db.query('DELETE FROM trips WHERE id = $1', [trip])
  assert.equal((await db.query('SELECT count(*)::int AS n FROM expense_payers')).rows[0].n, 0, 'whole-trip deletion can cascade')
  console.log(`Database checks passed: ${migrations.length} migrations; owner/admin writes, idempotency, input validation, stale edits, RLS, PIN sharing, receipt ownership, history protection and wallet refunds.`)
} finally {
  await db.close()
}
