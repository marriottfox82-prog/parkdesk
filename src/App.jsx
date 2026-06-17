import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import LoginPage   from './pages/LoginPage'
import DailyView   from './pages/DailyView'
import WeeklyPlan  from './pages/WeeklyPlan'
import AdminPage   from './pages/AdminPage'
import ProfilePage from './pages/ProfilePage'
import Nav         from './components/shared/Nav'

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
                    height:'100vh', fontFamily:'Geist, sans-serif',
                    color:'#999', fontSize:14 }}>
        Loading…
      </div>
    )
  }

  if (!session) return <LoginPage />

  return (
    <div style={{ display:'grid', gridTemplateRows:'48px 1fr', height:'100vh' }}>
      <Nav />
      <Routes>
        <Route path="/"        element={<Navigate to="/today" replace />} />
        <Route path="/today"   element={<DailyView />} />
        <Route path="/plan"    element={<WeeklyPlan />} />
        <Route path="/admin/*" element={<AdminPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*"        element={<Navigate to="/today" replace />} />
      </Routes>
    </div>
  )
}
