import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Default permissions — everything off until resolved
const DEFAULT_PERMISSIONS = {
  can_manage_roles:       false,
  can_manage_lot:         false,
  can_manage_staff:       false,
  can_manage_rules:       false,
  can_manage_allocations: false,
  can_send_move_requests: false,
  can_view_weekly_plan:   false,
  can_view_daily:         false,
  receive_notifications:  false,
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session,     setSession]     = useState(undefined) // undefined = loading
  const [staffRow,    setStaffRow]    = useState(null)
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchStaffAndPermissions(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session) fetchStaffAndPermissions(session.user.id)
        else {
          setStaffRow(null)
          setPermissions(DEFAULT_PERMISSIONS)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchStaffAndPermissions(authUserId) {
    // Step 1: fetch staff row
    const { data: staff } = await supabase
      .from('staff')
      .select('id, name, initials, app_role, organisation_id, role_id, role_label, staff_type, usual_arrival, usual_departure, mobility_needs')
      .eq('auth_user_id', authUserId)
      .single()

    if (!staff) return
    setStaffRow(staff)

    // app_role = 'admin' always gets full permissions — safety net
    if (staff.app_role === 'admin') {
      const allTrue = Object.fromEntries(Object.keys(DEFAULT_PERMISSIONS).map(k => [k, true]))
      setPermissions(allTrue)
      return
    }

    // Step 2: fetch role permissions if role assigned
    let rolePerms = {}
    if (staff.role_id) {
      const { data: role } = await supabase
        .from('roles')
        .select('can_manage_roles, can_manage_lot, can_manage_staff, can_manage_rules, can_manage_allocations, can_send_move_requests, can_view_weekly_plan, can_view_daily, receive_notifications')
        .eq('id', staff.role_id)
        .single()
      if (role) rolePerms = role
    }

    // Step 3: fetch per-user overrides
    const { data: overrides } = await supabase
      .from('staff_permission_overrides')
      .select('permission, value')
      .eq('staff_id', staff.id)

    // Merge role + overrides
    const merged = { ...DEFAULT_PERMISSIONS, ...rolePerms }
    if (overrides) {
      overrides.forEach(o => { merged[o.permission] = o.value })
    }

    setPermissions(merged)
  }

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password })
  }

  async function signOut() {
    return supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      session,
      staffRow,
      permissions,
      loading: session === undefined,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

// Convenience hook — returns true/false for a single permission
export function useCan(permission) {
  const { permissions } = useAuth()
  return permissions[permission] ?? false
}
