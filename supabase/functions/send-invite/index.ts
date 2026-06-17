// ============================================================
// send-invite
// Called by the admin screen when a new staff member is added
// or when reception clicks "Invite" / "Resend" on the invites
// table.
//
// POST /functions/v1/send-invite
// Auth: requires a valid session with app_role = admin or reception
// Body: { staff_id: string }
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Caller must be authenticated ─────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401)
    }

    // Client using the caller's JWT — RLS applies
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    // Admin client using service role — bypasses RLS for
    // privileged operations (auth.admin.inviteUserByEmail)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── Validate caller role ─────────────────────────────────
    const { data: caller, error: callerErr } = await supabaseClient
      .from('staff')
      .select('id, organisation_id, app_role')
      .eq('auth_user_id', (await supabaseClient.auth.getUser()).data.user?.id)
      .single()

    if (callerErr || !caller) {
      return json({ error: 'Could not resolve caller' }, 403)
    }

    if (!['admin', 'reception'].includes(caller.app_role)) {
      return json({ error: 'Insufficient role — admin or reception required' }, 403)
    }

    // ── Parse body ───────────────────────────────────────────
    const { staff_id } = await req.json()
    if (!staff_id) {
      return json({ error: 'staff_id is required' }, 400)
    }

    // ── Fetch the staff member ───────────────────────────────
    // Use admin client so we can read across the org regardless
    // of the caller's RLS scope
    const { data: member, error: memberErr } = await supabaseAdmin
      .from('staff')
      .select('id, name, email, organisation_id, auth_user_id, invite_sent_at')
      .eq('id', staff_id)
      .single()

    if (memberErr || !member) {
      return json({ error: 'Staff member not found' }, 404)
    }

    // Ensure the staff member belongs to the caller's org
    if (member.organisation_id !== caller.organisation_id) {
      return json({ error: 'Staff member not in your organisation' }, 403)
    }

    if (!member.email) {
      return json({ error: 'Staff member has no email address' }, 400)
    }

    // ── Fetch org for branding ───────────────────────────────
    const { data: org } = await supabaseAdmin
      .from('organisations')
      .select('name, reply_email')
      .eq('id', member.organisation_id)
      .single()

    // ── Send invite via Supabase Auth ────────────────────────
    // inviteUserByEmail sends the magic invite email and creates
    // the auth.users row in a pending state.
    // redirectTo is the page the user lands on after clicking
    // the link — should be your app's /setup or /accept page.
    const { data: inviteData, error: inviteErr } = await supabaseAdmin
      .auth.admin.inviteUserByEmail(member.email, {
        redirectTo: `${Deno.env.get('APP_URL')}/accept-invite`,
        data: {
          // These appear in auth.users.raw_user_meta_data
          // and can be read in the on-auth-user-created webhook
          staff_id:        member.id,
          organisation_id: member.organisation_id,
          full_name:       member.name,
        }
      })

    if (inviteErr) {
      // Supabase returns an error if the user already exists —
      // treat as a resend by generating a new recovery link
      if (inviteErr.message?.includes('already been registered')) {
        const { data: linkData, error: linkErr } = await supabaseAdmin
          .auth.admin.generateLink({
            type: 'invite',
            email: member.email,
            options: {
              redirectTo: `${Deno.env.get('APP_URL')}/accept-invite`,
              data: {
                staff_id:        member.id,
                organisation_id: member.organisation_id,
                full_name:       member.name,
              }
            }
          })

        if (linkErr) {
          return json({ error: `Failed to resend invite: ${linkErr.message}` }, 500)
        }
      } else {
        return json({ error: `Invite failed: ${inviteErr.message}` }, 500)
      }
    }

    // ── Record invite sent timestamp ─────────────────────────
    await supabaseAdmin
      .from('staff')
      .update({ invite_sent_at: new Date().toISOString() })
      .eq('id', staff_id)

    return json({
      success: true,
      message: `Invite sent to ${member.email}`,
      staff_id: member.id,
    })

  } catch (err) {
    return json({ error: `Unexpected error: ${err.message}` }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
