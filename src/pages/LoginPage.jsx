import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'

export default function LoginPage() {
  const { signIn }  = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
                  height:'100vh', background:'var(--bg)' }}>
      <div style={{ background:'var(--surface)', border:'0.5px solid var(--border-med)',
                    borderRadius:'var(--radius-lg)', padding:'32px', width:360 }}>
        <div style={{ fontSize:20, fontWeight:600, letterSpacing:'-0.4px', marginBottom:6 }}>
          Park<span style={{ color:'var(--green)' }}>Desk</span>
        </div>
        <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:24 }}>
          Whiteladies Medical Practice
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12, color:'var(--text-2)', display:'block', marginBottom:4 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ width:'100%', padding:'8px 10px', border:'0.5px solid var(--border-med)',
                       borderRadius:'var(--radius)', background:'var(--bg)', fontSize:13 }}
            />
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ fontSize:12, color:'var(--text-2)', display:'block', marginBottom:4 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ width:'100%', padding:'8px 10px', border:'0.5px solid var(--border-med)',
                       borderRadius:'var(--radius)', background:'var(--bg)', fontSize:13 }}
            />
          </div>

          {error && (
            <div style={{ fontSize:12, color:'var(--red)', marginBottom:14,
                          background:'var(--red-light)', padding:'8px 10px',
                          borderRadius:'var(--radius)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width:'100%', padding:'9px', background:'var(--green)',
                     border:'none', borderRadius:'var(--radius)', color:'#fff',
                     fontSize:13, fontWeight:500 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
