import { NavLink, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { supabase, ORG_ID } from '../../lib/supabase'
import styles from './Nav.module.css'

export default function Nav() {
  const { staffRow, permissions, signOut } = useAuth()
  const [orgName, setOrgName] = useState('')

  useEffect(() => {
    supabase
      .from('organisations')
      .select('name')
      .eq('id', ORG_ID)
      .single()
      .then(({ data }) => { if (data) setOrgName(data.name) })
  }, [])

  const canAdmin = permissions.can_manage_lot
    || permissions.can_manage_staff
    || permissions.can_manage_rules

  return (
    <nav className={styles.nav}>
      <span className={styles.brand}>Park<span>Desk</span></span>

      {permissions.can_view_daily && (
        <NavLink to="/today" className={({ isActive }) =>
          `${styles.tab} ${isActive ? styles.active : ''}`}>
          Today
        </NavLink>
      )}

      {permissions.can_view_weekly_plan && (
        <NavLink to="/plan" className={({ isActive }) =>
          `${styles.tab} ${isActive ? styles.active : ''}`}>
          Advance plan
        </NavLink>
      )}

      {canAdmin && (
        <NavLink to="/admin/lot" className={({ isActive }) =>
          `${styles.tab} ${isActive ? styles.active : ''}`}>
          Admin
        </NavLink>
      )}

      <div className={styles.right}>
        <span className={styles.orgName}>{orgName}</span>
        <Link to="/profile" className={styles.avatar} title="Your profile">
          {staffRow?.initials ?? '?'}
        </Link>
        <button className={styles.signOut} onClick={signOut}>Sign out</button>
      </div>
    </nav>
  )
}
