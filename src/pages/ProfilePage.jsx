import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

export default function ProfilePage() {
  const { staffRow, session } = useAuth()
  const [name,      setName]      = useState('')
  const [initials,  setInitials]  = useState('')
  const [password,  setPassword]  = useState('')
  const [password2, setPassword2] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [savingPw,  setSavingPw]  = useState(false)
  const [msg,       setMsg]       = useState(null)  // { type: 'ok'|'err', text }
  const [msgPw,     setMsgPw]     = useState(null)

  useEffect(() => {
    if (staffRow) {
      setName(staffRow.name ?? '')
      setInitials(staffRow.initials ?? '')
    }
  }, [staffRow])

  async function saveProfile(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setMsg(null)

    const { error } = await supabase
      .from('staff')
      .update({ name: name.trim(), initials: initials.trim().toUpperCase().slice(0,3) })
      .eq('id', staffRow.id)

    setSaving(false)
    setMsg(error
      ? { type:'err', text: error.message }
      : { type:'ok',  text: 'Profile updated — refresh the page to see your new initials in the nav.' }
    )
  }

  async function savePassword(e) {
    e.preventDefault()
    if (!password || !password2) return
    if (password !== password2) {
      setMsgPw({ type:'err', text: 'Passwords do not match.' })
      return
    }
    if (password.length < 8) {
      setMsgPw({ type:'err', text: 'Password must be at least 8 characters.' })
      return
    }
    setSavingPw(true)
    setMsgPw(null)

    const { error } = await supabase.auth.updateUser({ password })

    setSavingPw(false)
    if (error) {
      setMsgPw({ type:'err', text: error.message })
    } else {
      setMsgPw({ type:'ok', text: 'Password updated successfully.' })
      setPassword('')
      setPassword2('')
    }
  }

  if (!staffRow) return <div style={centreStyle}>Loading…</div>

  return (
    <div style={{ maxWidth:520, margin:'32px auto', padding:'0 16px' }}>

      <h1 style={{ fontSize:18, fontWeight:600, letterSpacing:'-0.3px',
                   color:'var(--text)', marginBottom:4 }}>
        Your profile
      </h1>
      <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:24 }}>
        {staffRow.role_label ?? 'Staff'} · {session?.user?.email}
      </p>

      {/* Name & initials */}
      <div style={cardStyle}>
        <div style={cardHdrStyle}>
          <div>
            <div style={cardTitleStyle}>Name &amp; initials</div>
            <div style={cardSubStyle}>Shown on space cards and in the navigation bar</div>
          </div>
        </div>
        <form onSubmit={saveProfile} style={{ padding:'14px 16px' }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Full name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <div style={{ ...fieldStyle, marginBottom:0 }}>
            <label style={labelStyle}>
              Initials
              <span style={{ color:'var(--text-3)', fontWeight:400, marginLeft:6 }}>
                2–3 characters, shown in your avatar
              </span>
            </label>
            <input
              type="text"
              value={initials}
              onChange={e => setInitials(e.target.value.toUpperCase().slice(0,3))}
              maxLength={3}
              style={{ ...inputStyle, width:80 }}
            />
          </div>

          {msg && (
            <div style={{ ...alertStyle,
                          background: msg.type==='ok' ? 'var(--green-light)' : 'var(--red-light)',
                          borderColor: msg.type==='ok' ? '#80d0b0' : '#f09090',
                          color: msg.type==='ok' ? 'var(--green-dark)' : 'var(--red)',
                          marginTop:12 }}>
              {msg.text}
            </div>
          )}

          <div style={{ marginTop:14, display:'flex', justifyContent:'flex-end' }}>
            <button type="submit" disabled={saving} style={btnPrimaryStyle}>
              {saving ? 'Saving…' : 'Save name'}
            </button>
          </div>
        </form>
      </div>

      {/* Password */}
      <div style={{ ...cardStyle, marginTop:14 }}>
        <div style={cardHdrStyle}>
          <div>
            <div style={cardTitleStyle}>Change password</div>
            <div style={cardSubStyle}>Must be at least 8 characters</div>
          </div>
        </div>
        <form onSubmit={savePassword} style={{ padding:'14px 16px' }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>New password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              style={inputStyle}
            />
          </div>
          <div style={{ ...fieldStyle, marginBottom:0 }}>
            <label style={labelStyle}>Confirm new password</label>
            <input
              type="password"
              value={password2}
              onChange={e => setPassword2(e.target.value)}
              autoComplete="new-password"
              style={inputStyle}
            />
          </div>

          {msgPw && (
            <div style={{ ...alertStyle,
                          background: msgPw.type==='ok' ? 'var(--green-light)' : 'var(--red-light)',
                          borderColor: msgPw.type==='ok' ? '#80d0b0' : '#f09090',
                          color: msgPw.type==='ok' ? 'var(--green-dark)' : 'var(--red)',
                          marginTop:12 }}>
              {msgPw.text}
            </div>
          )}

          <div style={{ marginTop:14, display:'flex', justifyContent:'flex-end' }}>
            <button type="submit" disabled={savingPw} style={btnPrimaryStyle}>
              {savingPw ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>

      {/* Read-only info */}
      <div style={{ ...cardStyle, marginTop:14 }}>
        <div style={cardHdrStyle}>
          <div style={cardTitleStyle}>Account details</div>
        </div>
        <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:10 }}>
          {[
            ['Email',       session?.user?.email ?? '—'],
            ['Role',        staffRow.role_label ?? '—'],
            ['Staff type',  staffRow.staff_type === 'pool' ? 'On-call pool' : 'Fixed rota'],
            ['Usual arrival',   staffRow.usual_arrival?.slice(0,5) ?? '—'],
            ['Usual departure', staffRow.usual_departure?.slice(0,5) ?? '—'],
          ].map(([label, value]) => (
            <div key={label} style={{ display:'flex', alignItems:'center' }}>
              <span style={{ fontSize:12, color:'var(--text-2)', width:140, flexShrink:0 }}>
                {label}
              </span>
              <span style={{ fontSize:13, color:'var(--text)', fontFamily:
                label.includes('arrival') || label.includes('departure') ? 'var(--mono)' : 'inherit' }}>
                {value}
              </span>
            </div>
          ))}
          <div style={{ fontSize:11, color:'var(--text-3)', marginTop:4,
                        paddingTop:10, borderTop:'0.5px solid var(--border)' }}>
            To change your email, role, or schedule contact your practice manager.
          </div>
        </div>
      </div>

    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────

const cardStyle = {
  background:'var(--surface)',
  border:'0.5px solid var(--border)',
  borderRadius:'var(--radius-lg)',
  overflow:'hidden',
}
const cardHdrStyle = {
  padding:'12px 16px',
  borderBottom:'0.5px solid var(--border)',
  display:'flex',
  alignItems:'center',
  justifyContent:'space-between',
}
const cardTitleStyle = { fontSize:13, fontWeight:600, color:'var(--text)' }
const cardSubStyle   = { fontSize:11, color:'var(--text-3)', marginTop:2 }
const fieldStyle     = { marginBottom:12 }
const labelStyle     = { fontSize:12, color:'var(--text-2)', display:'block', marginBottom:4, fontWeight:500 }
const inputStyle     = {
  width:'100%', padding:'7px 10px',
  border:'0.5px solid var(--border-med)',
  borderRadius:'var(--radius)',
  background:'var(--bg)',
  fontSize:13, color:'var(--text)',
  fontFamily:'inherit',
}
const alertStyle = {
  padding:'8px 10px',
  borderRadius:'var(--radius)',
  border:'0.5px solid',
  fontSize:12,
  lineHeight:1.5,
}
const btnPrimaryStyle = {
  fontSize:13, padding:'7px 16px',
  borderRadius:'var(--radius)',
  border:'none',
  background:'var(--green)',
  color:'#fff',
  fontWeight:500,
  cursor:'pointer',
  fontFamily:'inherit',
}
const centreStyle = {
  display:'flex', alignItems:'center', justifyContent:'center',
  height:'100%', fontSize:13, color:'var(--text-3)',
}
