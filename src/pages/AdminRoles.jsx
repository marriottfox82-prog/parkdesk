import { useState, useEffect, useCallback } from 'react'
import { supabase, ORG_ID } from '../lib/supabase'

const PERMISSIONS = [
  { key:'can_manage_roles',        label:'Manage roles',        desc:'Create, edit and delete roles' },
  { key:'can_manage_lot',          label:'Manage lot layout',   desc:'Edit spaces, rows and reservations' },
  { key:'can_manage_staff',        label:'Manage staff',        desc:'Add, edit and remove staff members' },
  { key:'can_manage_rules',        label:'Manage rules',        desc:'Edit priority rules and algorithm settings' },
  { key:'can_manage_allocations',  label:'Manage allocations',  desc:'Edit weekly plan and space assignments' },
  { key:'can_send_move_requests',  label:'Send move requests',  desc:'Notify staff to move their car' },
  { key:'can_view_weekly_plan',    label:'View weekly plan',    desc:'See the advance planning grid' },
  { key:'can_view_daily',          label:'View daily view',     desc:'See today\'s lot and roster' },
  { key:'receive_notifications',   label:'Receive notifications', desc:'Receive move request alerts' },
]

export default function AdminRoles() {
  const [roles,    setRoles]    = useState([])
  const [staff,    setStaff]    = useState([])
  const [selected, setSelected] = useState(null) // role id being edited
  const [loading,  setLoading]  = useState(true)
  const [msg,      setMsg]      = useState(null)
  const [adding,   setAdding]   = useState(false)
  const [newName,  setNewName]  = useState('')

  const fetch = useCallback(async () => {
    setLoading(true)
    const [{ data: roleData }, { data: staffData }] = await Promise.all([
      supabase
        .from('roles')
        .select('*')
        .eq('organisation_id', ORG_ID)
        .order('is_system', { ascending: false })
        .order('role_name'),
      supabase
        .from('staff')
        .select('id, name, initials, role_id')
        .eq('organisation_id', ORG_ID)
        .order('name'),
    ])
    setRoles(roleData || [])
    setStaff(staffData || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  function staffForRole(roleId) {
    return staff.filter(s => s.role_id === roleId)
  }

  async function togglePermission(role, permKey) {
    if (role.is_system && permKey === 'can_manage_roles' && !role.can_manage_roles) {
      // Don't let anyone accidentally lock themselves out
    }
    const newVal = !role[permKey]
    const { error } = await supabase
      .from('roles')
      .update({ [permKey]: newVal })
      .eq('id', role.id)

    if (error) {
      setMsg({ type:'err', text: error.message })
    } else {
      setRoles(prev => prev.map(r => r.id === role.id ? { ...r, [permKey]: newVal } : r))
    }
  }

  async function addRole() {
    if (!newName.trim()) return
    const { error } = await supabase
      .from('roles')
      .insert({
        organisation_id:      ORG_ID,
        role_name:            newName.trim(),
        description:          '',
        is_system:            false,
        can_view_daily:       true,
        receive_notifications:true,
      })
    if (error) {
      setMsg({ type:'err', text: error.message })
    } else {
      setNewName('')
      setAdding(false)
      fetch()
    }
  }

  async function deleteRole(role) {
    if (role.is_system) return
    const assigned = staffForRole(role.id)
    if (assigned.length > 0) {
      setMsg({ type:'err', text: `Cannot delete — ${assigned.length} staff assigned to this role. Reassign them first.` })
      return
    }
    if (!window.confirm(`Delete role "${role.role_name}"?`)) return
    await supabase.from('roles').delete().eq('id', role.id)
    if (selected === role.id) setSelected(null)
    fetch()
  }

  async function updateDescription(role, desc) {
    await supabase.from('roles').update({ description: desc }).eq('id', role.id)
  }

  async function assignRole(staffId, roleId) {
    await supabase
      .from('staff')
      .update({ role_id: roleId || null })
      .eq('id', staffId)
    setStaff(prev => prev.map(s => s.id === staffId ? { ...s, role_id: roleId || null } : s))
    flash('Role assigned.')
  }

  function flash(text, type='ok') {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3000)
  }

  if (loading) return <div style={centreStyle}>Loading roles…</div>

  const selectedRole = roles.find(r => r.id === selected)

  return (
    <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', height:'100%', overflow:'hidden' }}>

      {/* ── Role list ─────────────────────────────────────── */}
      <div style={{ borderRight:'0.5px solid var(--border)', overflowY:'auto',
                    padding:'16px 12px', background:'var(--surface)' }}>
        <div style={{ fontSize:10, fontWeight:600, color:'var(--text-3)',
                      textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>
          Roles
        </div>

        {roles.map(role => {
          const count = staffForRole(role.id).length
          const isActive = selected === role.id
          return (
            <div
              key={role.id}
              onClick={() => setSelected(isActive ? null : role.id)}
              style={{
                padding:'9px 10px', borderRadius:'var(--radius)', marginBottom:4,
                cursor:'pointer', border:`0.5px solid ${isActive ? 'var(--green)' : 'var(--border)'}`,
                background: isActive ? 'var(--green-light)' : 'var(--surface)',
              }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:13, fontWeight:500,
                               color: isActive ? 'var(--green-dark)' : 'var(--text)', flex:1 }}>
                  {role.role_name}
                </span>
                {role.is_system && (
                  <span style={{ fontSize:9, color:'var(--text-3)', padding:'1px 5px',
                                 border:'0.5px solid var(--border)', borderRadius:3 }}>
                    system
                  </span>
                )}
              </div>
              <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
                {count} staff member{count !== 1 ? 's' : ''}
              </div>
            </div>
          )
        })}

        {/* Add role */}
        {adding
          ? <div style={{ marginTop:8, padding:'10px', background:'var(--bg)',
                          border:'0.5px solid var(--border)', borderRadius:'var(--radius)' }}>
              <input
                autoFocus
                placeholder="Role name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRole()}
                style={{ ...inputStyle, width:'100%', marginBottom:7 }}
              />
              <div style={{ display:'flex', gap:6 }}>
                <button style={btnPrimary} onClick={addRole}>Add</button>
                <button style={btnStyle} onClick={() => { setAdding(false); setNewName('') }}>
                  Cancel
                </button>
              </div>
            </div>
          : <button style={{ ...btnStyle, marginTop:8, width:'100%', justifyContent:'center' }}
                    onClick={() => setAdding(true)}>
              + Add role
            </button>
        }
      </div>

      {/* ── Role detail ───────────────────────────────────── */}
      <div style={{ overflowY:'auto', padding:'20px 20px', background:'var(--bg)' }}>

        {msg && (
          <div style={{ ...alertStyle,
                        background: msg.type==='ok' ? 'var(--green-light)' : 'var(--red-light)',
                        borderColor: msg.type==='ok' ? '#80d0b0' : '#f09090',
                        color: msg.type==='ok' ? 'var(--green-dark)' : 'var(--red)',
                        marginBottom:14 }}>
            {msg.text}
          </div>
        )}

        {!selectedRole
          ? <div style={{ fontSize:13, color:'var(--text-3)', paddingTop:40, textAlign:'center' }}>
              Select a role to view and edit its permissions
            </div>
          : <>
              {/* Role header */}
              <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:16 }}>
                <div style={{ flex:1 }}>
                  <h2 style={{ fontSize:16, fontWeight:600, letterSpacing:'-0.2px',
                               color:'var(--text)', marginBottom:4 }}>
                    {selectedRole.role_name}
                    {selectedRole.is_system && (
                      <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:400,
                                     marginLeft:8 }}>
                        system role
                      </span>
                    )}
                  </h2>
                  <input
                    defaultValue={selectedRole.description ?? ''}
                    placeholder="Add a description…"
                    onBlur={e => updateDescription(selectedRole, e.target.value)}
                    style={{ ...inputStyle, width:'100%' }}
                  />
                </div>
                {!selectedRole.is_system && (
                  <button
                    style={{ ...btnStyle, color:'var(--red)', borderColor:'var(--red)',
                             flexShrink:0 }}
                    onClick={() => deleteRole(selectedRole)}>
                    Delete role
                  </button>
                )}
              </div>

              {/* Permissions */}
              <div style={cardStyle}>
                <div style={cardHdr}>
                  <div style={cardTitle}>Permissions</div>
                  <div style={cardSub}>
                    Toggle permissions for this role. Changes apply immediately.
                    {selectedRole.is_system && ' System role permissions can be edited but the role cannot be deleted.'}
                  </div>
                </div>
                <div style={{ padding:'4px 0' }}>
                  {PERMISSIONS.map((perm, i) => (
                    <div key={perm.key} style={{
                      display:'flex', alignItems:'center', gap:12,
                      padding:'11px 16px',
                      borderBottom: i < PERMISSIONS.length - 1
                        ? '0.5px solid var(--border)' : 'none',
                    }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:500, color:'var(--text)' }}>
                          {perm.label}
                        </div>
                        <div style={{ fontSize:11, color:'var(--text-3)', marginTop:1 }}>
                          {perm.desc}
                        </div>
                      </div>
                      <Toggle
                        value={!!selectedRole[perm.key]}
                        onChange={() => togglePermission(selectedRole, perm.key)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Staff assigned to this role */}
              <div style={{ ...cardStyle, marginTop:12 }}>
                <div style={cardHdr}>
                  <div style={cardTitle}>
                    Staff assigned
                    <span style={{ fontWeight:400, color:'var(--text-3)', marginLeft:6 }}>
                      {staffForRole(selectedRole.id).length}
                    </span>
                  </div>
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr>
                      {['Name','Current role','Change role'].map(h => (
                        <th key={h} style={{ fontSize:10, fontWeight:600, color:'var(--text-3)',
                                             textTransform:'uppercase', letterSpacing:'.04em',
                                             textAlign:'left', padding:'7px 14px',
                                             borderBottom:'0.5px solid var(--border)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map(s => (
                      <tr key={s.id} style={{ borderBottom:'0.5px solid var(--border)' }}>
                        <td style={{ padding:'9px 14px', fontSize:13, color:'var(--text)' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                            <div style={{ width:24, height:24, borderRadius:'50%',
                                          background:'var(--green-light)', color:'var(--green-dark)',
                                          fontSize:9, fontWeight:600, display:'flex',
                                          alignItems:'center', justifyContent:'center',
                                          flexShrink:0 }}>
                              {s.initials}
                            </div>
                            {s.name}
                          </div>
                        </td>
                        <td style={{ padding:'9px 14px', fontSize:12, color:'var(--text-2)' }}>
                          {roles.find(r => r.id === s.role_id)?.role_name ?? '—'}
                        </td>
                        <td style={{ padding:'9px 14px' }}>
                          <select
                            value={s.role_id ?? ''}
                            onChange={e => assignRole(s.id, e.target.value)}
                            style={{ ...inputStyle, fontSize:12 }}>
                            <option value="">— No role —</option>
                            {roles.map(r => (
                              <option key={r.id} value={r.id}>{r.role_name}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
        }
      </div>
    </div>
  )
}

// ── Toggle component ─────────────────────────────────────────

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={onChange}
      style={{
        width:36, height:20, borderRadius:10, border:'none', cursor:'pointer',
        background: value ? 'var(--green)' : '#ddd',
        position:'relative', flexShrink:0, transition:'background .15s',
      }}>
      <span style={{
        width:16, height:16, borderRadius:'50%', background:'#fff',
        position:'absolute', top:2,
        left: value ? 18 : 2,
        transition:'left .15s',
        display:'block',
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
const cardSub     = { fontSize:11, color:'var(--text-3)', marginTop:2, lineHeight:1.4 }
const alertStyle  = { padding:'8px 12px', borderRadius:'var(--radius)',
                      border:'0.5px solid', fontSize:12, lineHeight:1.5 }
const btnStyle    = { fontSize:12, padding:'6px 12px', borderRadius:'var(--radius)',
                      border:'0.5px solid var(--border-med)', background:'var(--surface)',
                      color:'var(--text)', cursor:'pointer', fontFamily:'inherit',
                      display:'inline-flex', alignItems:'center', gap:5 }
const btnPrimary  = { ...btnStyle, background:'var(--green)', borderColor:'var(--green)',
                      color:'#fff', fontWeight:500 }
const inputStyle  = { fontSize:13, padding:'6px 9px', border:'0.5px solid var(--border-med)',
                      borderRadius:'var(--radius)', background:'var(--bg)',
                      color:'var(--text)', fontFamily:'inherit' }
