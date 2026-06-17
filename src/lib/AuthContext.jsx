import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(undefined) // undefined = loading
  const [staffRow, setStaffRow] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchStaffRow(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session) fetchStaffRow(session.user.id)
        else setStaffRow(null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchStaffRow(authUserId) {
    const { data } = await supabase
      .from('staff')
      .select('id, name, initials, app_role, organisation_id')
      .eq('auth_user_id', authUserId)
      .single()
    setStaffRow(data)
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
      loading: session === undefined,
      signIn,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
