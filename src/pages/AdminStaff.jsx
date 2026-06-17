import { useState, useEffect, useCallback } from 'react'
import { supabase, ORG_ID } from '../lib/supabase'

const PERMISSIONS = [
  { key:'can_manage_roles',        label:'Manage roles' },
  { key:'can_manage_lot',          label:'Manage lot layout' },
  { key:'can_manage_staff',        label:'Manage staff' },
  { key:'can_manage_rules',        label:'Manage rules' },
  { key:'can_manage_allocations',  label:'Manage allocations' },
  { key:'can_send_move_requests',  label:'Send move requests' },
  { key:'can_view_weekly_plan',    label:'View weekly plan' },
  { key:'can_view_daily',          label:'View daily view' },
  { key:'receive_notifications',   label:'Receive notifications' },
]

export default function AdminStaff() {
  const [staff,     setStaff]     = useState([])
  const [roles,     setRoles]     = useState([])
  const [overrides, setOverrides] = useState({}) // { staffId: { permission: value } }
  const [selected,  setSelected]  = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [msg,       setMsg]       = useState(null)
  const [editField, setEditField] = useState({}) // { field: value } for selected staff

  const fetch = useCallback(async () => {
    setLoading(true)
    const [{ data: staffData }, { data: rolesData }, { data: overridesData }] = await Promise.all([
      supabase
        .from('staff')
        .select('id, name, initials, email, app_role, role_id, role_label, staff_type, usual_arrival, usual_departure, mobility_needs, notes, invite_sent_at, invite_accepted_at, auth_user_id')
        .eq('organisation_id', ORG_ID)
        .order('name'),
      supabase
        .from('roles')
        .select('id, role_name, can_manage_roles, can_manage_lot, can_manage_staff, can_manage_rules, can_manage_allocations, can_send_move_requests, can_view_weekly_plan, can_view_daily, receive_notifications')
        .eq('organisation_id', ORG_ID)
        .order('role_name'),
      supabase
        .from('staff_permission_overrides')
        .select('staff_id, permission, value'),
    ])

    // Build overrides lookup: { staffId: { permission: value } }
    const overrideLookup = {}
    ;(overridesData || []).forEach(o => {
      if (!overrideLookup[o.staff_id]) overrideLookup[o.staff_id] = {}
      overrideLookup[o.staff_id][o.permission] = o.value
    })

    setStaff(staffData || [])
    setRoles(rolesData || [])
    setOverrides(overrideLookup)
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  function selectedStaff() {
    return staff.find(s => s.id === selected)
  }

  function roleFor(staffMember) {
    return roles.find(r => r.id === staffMember?.role_id)
  }

  // Resolved permission for a staff member (role + override)
  function resolvedPerm(staffMember, permKey) {
    const role = roleFor(staffMember)
    const roleVal = role?.[permKey] ?? false
    const override = overrides[staffMember.id]?.[permKey]
    return override !== undefined ? override : roleVal
  }

  function hasOverride(staffMember, permKey) {
    return overrides[staffMember?.id]?.[permKey] !== undefined
  }

  async function saveField(field, value) {
    setSaving(true)
    const { error } = await supabase
      .from('staff')
      .update({ [field]: value })
      .eq('id', selected)
    setSaving(false)
    if (error) flash(error.message, 'err')
    else {
      setStaff(prev => prev.map(s => s.id === selected ? { ...s, [field]: value } : s))
      flash('Saved.')
    }
  }

  async function setOverride(staffId, permKey, value) {
    // If value matches role default, remove the override
    const role = roleFor(selectedStaff())
    const roleDefault = role?.[permKey] ?? false

    if (value === roleDefault) {
      // Remove override
      await supabase
        .from('staff_permission_overrides')
        .delete()
        .eq('staff_id', staffId)
        .eq('permission', permKey)
      setOverrides(prev => {
        const next = { ...prev }
        if (next[staffId]) {
          delete next[staffId][permKey]
        }
        return next
      })
    } else {
      // Upsert override
      await supabase
        .from('staff_permission_overrides')
        .upsert({ staff_id: staffId, permission: permKey, value },
                 { onConflict: 'staff_id,permission' })
      setOverrides(prev => ({
        ...prev,
        [staffId]: { ...(prev[staffId] || {}), [permKey]: value }
      }))
    }
  }

  async function clearAllOverrides(staffId) {
    await supabase
      .from('staff_permission_overrides')
      .delete()
      .eq('staff_id', staffId)
    setOverrides(prev => {
      const next = { ...prev }
      delete next[staffId]
      return next
    })
    flash('All overrides cleared.')
  }

  function flash(text, type = 'ok') {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3000)
  }

  if (loading) return <div style={centreStyle}>Loading staff…</div>

  const person = selectedStaff()
  const role   = roleFor(person)
  const personOverrides = overrides[person?.id] || {}
  const overrideCount = Object.keys(personOverrides).length

  return (
    <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', height:'100%', overflow:'hidden' }}>

      {/* ── Staff list ────────────────────────────────────── */}
      <div style={{ borderRight:'0.5px solid var(--border)', overflowY:'auto',
                    padding:'14px 10px', background:'var(--surface)' }}>
        <div style={{ fontSize:10, fontWeight:600, color:'var(--text-3)',
                      textTransform:'uppercase', letterSpacing:'.05em',
                      margin:'0 4px 10px' }}>
          {staff.length} staff members
        </div>

        {staff.map(s => {
          const isActive = selected === s.id
          const sRole = roles.find(r => r.id === s.role_id)
          const hasOverrides = Object.keys(overrides[s.id] || {}).length > 0
          return (
            <div
              key={s.id}
              onClick={() => setSelected(isActive ? null : s.id)}
              style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'7px 8px', borderRadius:'var(--radius)', marginBottom:2,
                cursor:'pointer',
                background: isActive ? 'var(--green-light)' : 'transparent',
                border: `0.5px solid ${isActive ? 'var(--green)' : 'transparent'}`,
              }}>
              <div style={{ width:28, height:28, borderRadius:'50%', flexShrink:0,
                            background: isActive ? 'var(--green)' : 'var(--bg)',
                            color: isActive ? '#fff' : 'var(--text-2)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:10, fontWeight:600 }}>
                {s.initials}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:500,
                              color: isActive ? 'var(--green-dark)' : 'var(--text)',
                              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {s.name}
                </div>
                <div style={{ fontSize:10, color:'var(--text-3)' }}>
                  {sRole?.role_name ?? '—'}
                  {hasOverrides && <span style={{ color:'var(--amber)', marginLeft:4 }}>● overrides</span>}
                </div>
              </div>
              {!s.auth_user_id && (
                <span style={{ fontSize:9, color:'var(--amber)', padding:'1px 4px',
                               border:'0.5px solid var(--amber-mid)', borderRadius:3,
                               flexShrink:0 }}>
                  no login
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Staff detail ──────────────────────────────────── */}
      <div style={{ overflowY:'auto', padding:'20px', background:'var(--bg)' }}>

        {msg && (
          <div style={{ ...alertStyle,
                        background: msg.type==='ok' ? 'var(--green-light)' : 'var(--red-light)',
                        borderColor: msg.type==='ok' ? '#80d0b0' : '#f09090',
                        color: msg.type==='ok' ? 'var(--green-dark)' : 'var(--red)',
                        marginBottom:14 }}>
            {msg.text}
          </div>
        )}

        {!person
          ? <div style={{ fontSize:13, color:'var(--text-3)', paddingTop:40, textAlign:'center' }}>
              Select a staff member to view and edit their details
            </div>
          : <>
              {/* Header */}
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
                <div style={{ width:44, height:44, borderRadius:'50%',
                              background:'var(--green-light)', color:'var(--green-dark)',
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:14, fontWeight:600, flexShrink:0 }}>
                  {person.initials}
                </div>
                <div>
                  <h2 style={{ fontSize:16, fontWeight:600, letterSpacing:'-0.2px', color:'var(--text)' }}>
                    {person.name}
                  </h2>
                  <div style={{ fontSize:12, color:'var(--text-2)' }}>
                    {role?.role_name ?? 'No role assigned'} · {person.email ?? 'No email'}
                  </div>
                </div>
                <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
                  {person.auth_user_id
                    ? <span style={{ fontSize:12, color:'var(--green-dark)', background:'var(--green-light)',
                                     padding:'3px 8px', borderRadius:'var(--radius)',
                                     border:'0.5px solid #80d0b0' }}>
                        ✓ Active account
                      </span>
                    : <span style={{ fontSize:12, color:'var(--amber)', background:'var(--amber-light)',
                                     padding:'3px 8px', borderRadius:'var(--radius)',
                                     border:'0.5px solid var(--amber-mid)' }}>
                        No login yet
                      </span>
                  }
                </div>
              </div>

              {/* Details */}
              <div style={cardStyle}>
                <div style={cardHdr}><div style={cardTitle}>Details</div></div>
                <div style={{ padding:'14px 16px', display:'grid',
                              gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <Field label="Full name" value={person.name}
                    onSave={v => saveField('name', v)} />
                  <Field label="Email" value={person.email ?? ''}
                    onSave={v => saveField('email', v)} type="email" />
                  <Field label="Role label" value={person.role_label ?? ''}
                    placeholder="e.g. GP, Receptionist"
                    onSave={v => saveField('role_label', v)} />
                  <div>
                    <div style={labelStyle}>Assigned role</div>
                    <select
                      value={person.role_id ?? ''}
                      onChange={e => saveField('role_id', e.target.value || null)}
                      style={{ ...inputStyle, width:'100%' }}>
                      <option value="">— No role —</option>
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.role_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div style={labelStyle}>Staff type</div>
                    <select
                      value={person.staff_type}
                      onChange={e => saveField('staff_type', e.target.value)}
                      style={{ ...inputStyle, width:'100%' }}>
                      <option value="fixed">Fixed rota</option>
                      <option value="pool">On-call pool</option>
                    </select>
                  </div>
                  <div>
                    <div style={labelStyle}>App role</div>
                    <select
                      value={person.app_role}
                      onChange={e => saveField('app_role', e.target.value)}
                      style={{ ...inputStyle, width:'100%' }}>
                      <option value="staff">Staff</option>
                      <option value="reception">Reception</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <Field label="Usual arrival" value={person.usual_arrival?.slice(0,5) ?? ''}
                    placeholder="08:30" onSave={v => saveField('usual_arrival', v)} />
                  <Field label="Usual departure" value={person.usual_departure?.slice(0,5) ?? ''}
                    placeholder="17:00" onSave={v => saveField('usual_departure', v)} />
                </div>
                <div style={{ padding:'0 16px 14px', display:'flex',
                              flexDirection:'column', gap:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <Toggle
                      value={!!person.mobility_needs}
                      onChange={() => saveField('mobility_needs', !person.mobility_needs)}
                    />
                    <div>
                      <div style={{ fontSize:13, fontWeight:500, color:'var(--text)' }}>
                        Mobility needs
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-3)' }}>
                        Algorithm will not assign overflow or distant spaces
                      </div>
                    </div>
                  </div>
                  <div>
                    <div style={labelStyle}>Notes (admin only)</div>
                    <textarea
                      defaultValue={person.notes ?? ''}
                      onBlur={e => saveField('notes', e.target.value)}
                      placeholder="e.g. mobility exemption reason, temporary arrangements…"
                      style={{ ...inputStyle, width:'100%', height:60, resize:'none',
                               lineHeight:1.5 }}
                    />
                  </div>
                </div>
              </div>

              {/* Permission overrides */}
              <div style={{ ...cardStyle, marginTop:12 }}>
                <div style={{ ...cardHdr, display:'flex', alignItems:'center',
                              justifyContent:'space-between' }}>
                  <div>
                    <div style={cardTitle}>
                      Permission overrides
                      {overrideCount > 0 && (
                        <span style={{ fontSize:11, color:'var(--amber)', fontWeight:400,
                                       marginLeft:8 }}>
                          {overrideCount} override{overrideCount !== 1 ? 's' : ''} active
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
                      Overrides apply on top of the <strong>{role?.role_name ?? 'assigned'}</strong> role.
                      Amber = differs from role default.
                    </div>
                  </div>
                  {overrideCount > 0 && (
                    <button style={{ ...btnStyle, fontSize:11, color:'var(--red)',
                                     borderColor:'var(--red)' }}
                            onClick={() => clearAllOverrides(person.id)}>
                      Clear all overrides
                    </button>
                  )}
                </div>
                <div>
                  {PERMISSIONS.map((perm, i) => {
                    const resolved  = resolvedPerm(person, perm.key)
                    const isOverride = hasOverride(person, perm.key)
                    const roleDefault = role?.[perm.key] ?? false
                    return (
                      <div key={perm.key} style={{
                        display:'flex', alignItems:'center', gap:12,
                        padding:'10px 16px',
                        borderBottom: i < PERMISSIONS.length - 1
                          ? '0.5px solid var(--border)' : 'none',
                        background: isOverride ? 'var(--amber-light)' : 'transparent',
                      }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight: isOverride ? 500 : 400,
                                        color:'var(--text)' }}>
                            {perm.label}
                          </div>
                          {isOverride && (
                            <div style={{ fontSize:10, color:'var(--amber)', marginTop:1 }}>
                              Override active — role default is {roleDefault ? 'on' : 'off'}
                            </div>
                          )}
                        </div>
                        <Toggle
                          value={resolved}
                          onChange={() => setOverride(person.id, perm.key, !resolved)}
                          amber={isOverride}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
        }
      </div>
    </div>
  )
}

// ── Field component ──────────────────────────────────────────

function Field({ label, value, onSave, type = 'text', placeholder }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <input
        type={type}
        defaultValue={value}
        placeholder={placeholder}
        onBlur={e => { if (e.target.value !== value) onSave(e.target.value) }}
        style={{ ...inputStyle, width:'100%' }}
      />
    </div>
  )
}

// ── Toggle ───────────────────────────────────────────────────

function Toggle({ value, onChange, amber }) {
  return (
    <button
      onClick={onChange}
      style={{
        width:36, height:20, borderRadius:10, border:'none', cursor:'pointer',
        background: value ? (amber ? 'var(--amber-mid)' : 'var(--green)') : '#ddd',
        position:'relative', flexShrink:0, transition:'background .15s',
      }}>
      <span style={{
        width:16, height:16, borderRadius:'50%', background:'#fff',
        position:'absolute', top:2,
        left: value ? 18 : 2,
        transition:'left .15s', display:'block',
      }} />
    </button>
  )
}

// ── Styles ───────────────────────────────────────────────────

const centreStyle = { display:'flex', alignItems:'center', justifyContent:'center',
                      height:'100%', fontSize:13, color:'var(--text-3)' }
const cardStyle   = { background:'var(--surface)', border:'0.5px solid var(--border)',
                      borderRadius:'var(--radius-lg)', overflow:'hidden' }
const cardHdr     = { padding:'12px 16px', borderBottom:'0.5px solid var(--border)' }
const cardTitle   = { fontSize:13, fontWeight:600, color:'var(--text)' }
const alertStyle  = { padding:'8px 12px', borderRadius:'var(--radius)',
                      border:'0.5px solid', fontSize:12, lineHeight:1.5 }
const btnStyle    = { fontSize:12, padding:'5px 10px', borderRadius:'var(--radius)',
                      border:'0.5px solid var(--border-med)', background:'var(--surface)',
                      color:'var(--text)', cursor:'pointer', fontFamily:'inherit' }
const labelStyle  = { fontSize:11, color:'var(--text-2)', marginBottom:4,
                      fontWeight:500, display:'block' }
const inputStyle  = { fontSize:13, padding:'6px 9px', border:'0.5px solid var(--border-med)',
                      borderRadius:'var(--radius)', background:'var(--bg)',
                      color:'var(--text)', fontFamily:'inherit' }
