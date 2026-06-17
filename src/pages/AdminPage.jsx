import { NavLink, Routes, Route, Navigate } from 'react-router-dom'
import AdminLotLayout from './AdminLotLayout'

const navItems = [
  { to: 'lot',   label: 'Lot layout' },
  { to: 'staff', label: 'Staff & roles' },
  { to: 'rules', label: 'Priority rules' },
  { to: 'notify',label: 'Notifications' },
]

export default function AdminPage() {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'160px 1fr',
                  height:'100%', overflow:'hidden' }}>

      {/* Admin sub-nav */}
      <nav style={{ borderRight:'0.5px solid var(--border)', background:'var(--surface)',
                    padding:'14px 10px', overflowY:'auto' }}>
        <div style={{ fontSize:10, fontWeight:600, color:'var(--text-3)',
                      textTransform:'uppercase', letterSpacing:'.05em',
                      margin:'0 6px 8px' }}>
          Admin
        </div>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display:'block', padding:'7px 10px',
              borderRadius:'var(--radius)', marginBottom:2,
              fontSize:13, textDecoration:'none',
              color: isActive ? 'var(--green-dark)' : 'var(--text-2)',
              background: isActive ? 'var(--green-light)' : 'transparent',
              fontWeight: isActive ? 500 : 400,
            })}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Admin content */}
      <div style={{ overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <Routes>
          <Route index element={<Navigate to="lot" replace />} />
          <Route path="lot"    element={<AdminLotLayout />} />
          <Route path="staff"  element={<AdminStub label="Staff & roles" />} />
          <Route path="rules"  element={<AdminStub label="Priority rules" />} />
          <Route path="notify" element={<AdminStub label="Notifications" />} />
        </Routes>
      </div>
    </div>
  )
}

function AdminStub({ label }) {
  return (
    <div style={{ padding:24, fontSize:13, color:'var(--text-2)' }}>
      {label} — coming soon
    </div>
  )
}
