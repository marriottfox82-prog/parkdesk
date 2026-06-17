// ============================================================
// on-auth-user-created
// Supabase Auth webhook — fires when a user accepts their
// invite and the auth.users row is confirmed.
//
// Configure in Supabase dashboard:
//   Authentication → Hooks → "Send email" hook
//   Point to this function's URL
//   Secret: set WEBHOOK_SECRET in function env vars
//
// What it does:
//   1. Reads staff_id from the user's metadata (set at invite time)
//   2. Links auth_user_id on the staff row
//   3. Records invite_accepted_at
//   4. Sets the user's app_role as a custom JWT claim
//      so RLS can use it without a DB round-trip
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac }   from 'https://deno.land/std@0.177.0/node/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Verify webhook signature ─────────────────────────────
    // Supabase signs the webhook payload with HMAC-SHA256.
    // Reject anything that doesn't match.
    const secret = Deno.env.get('WEBHOOK_SECRET')
    if (secret) {
      const signature = req.headers.get('x-supabase-signature')
      const body      = await req.text()
      const expected  = createHmac('sha256', secret).update(body).digest('hex')

      if (signature !== expected) {
        return json({ error: 'Invalid webhook signature' }, 401)
      }

      // Re-parse since we consumed the stream
      var payload = JSON.parse(body)
    } else {
      var payload = await req.json()
    }

    // ── Expect auth hook payload shape ───────────────────────
    // { type: 'INSERT', table: 'users', record: { id, email,
    //   email_confirmed_at, raw_user_meta_data: { staff_id, ... } } }
    const record = payload?.record
    if (!record) {
      return json({ error: 'No record in payload' }, 400)
    }

    // Only act on email-confirmed events
    // (the hook fires on INSERT which happens at invite-send time,
    // but email_confirmed_at is null until the user clicks the link)
    if (!record.email_confirmed_at) {
      return json({ skipped: 'Email not yet confirmed' })
    }

    const authUserId = record.id
    const email      = record.email
    const meta       = record.raw_user_meta_data ?? {}
    const staffId    = meta.staff_id

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── Link auth user → staff row ───────────────────────────
    let staffRow: any = null

    if (staffId) {
      // Best case: we have the staff_id from invite metadata
      const { data, error } = await supabaseAdmin
        .from('staff')
        .update({
          auth_user_id:       authUserId,
          invite_accepted_at: new Date().toISOString(),
        })
        .eq('id', staffId)
        .is('auth_user_id', null)   // safety: don't overwrite an existing link
        .select('id, app_role, organisation_id')
        .single()

      if (!error && data) staffRow = data
    }

    if (!staffRow) {
      // Fallback: match by email (handles manual invites or
      // cases where metadata wasn't set)
      const { data, error } = await supabaseAdmin
        .from('staff')
        .update({
          auth_user_id:       authUserId,
          invite_accepted_at: new Date().toISOString(),
        })
        .eq('email', email)
        .is('auth_user_id', null)
        .select('id, app_role, organisation_id')
        .single()

      if (!error && data) staffRow = data
    }

    if (!staffRow) {
      // No matching staff row — could be a test signup or
      // someone who got added to auth directly. Log and move on.
      console.warn(`No unlinked staff row found for auth user ${authUserId} / ${email}`)
      return json({ skipped: 'No matching staff row' })
    }

    // ── Set custom JWT claims ────────────────────────────────
    // These appear in the JWT under app_metadata and are
    // available as auth.jwt()->'app_metadata'->>'app_role'
    // in RLS policies — faster than a DB lookup per request.
    await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      app_metadata: {
        app_role:        staffRow.app_role,
        organisation_id: staffRow.organisation_id,
        staff_id:        staffRow.id,
      }
    })

    console.log(
      `Linked auth user ${authUserId} → staff ${staffRow.id}`,
      `(${staffRow.app_role} / org ${staffRow.organisation_id})`
    )

    return json({
      success:  true,
      staff_id: staffRow.id,
      app_role: staffRow.app_role,
    })

  } catch (err) {
    console.error('on-auth-user-created error:', err)
    return json({ error: `Unexpected error: ${err.message}` }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
