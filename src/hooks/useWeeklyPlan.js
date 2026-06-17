// useWeeklyPlan
// Fetches spaces, allocations, and roster for a Mon–Fri week.
// Returns structured data ready for the grid UI.

import { useEffect, useState, useCallback } from 'react'
import { supabase, ORG_ID } from '../lib/supabase'

export function useWeeklyPlan(weekStart) {
  const [spaces,      setSpaces]      = useState([])
  const [allocations, setAllocations] = useState([])
  const [roster,      setRoster]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  const weekEnd = getWeekEnd(weekStart)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Spaces with row info and reserved-for staff
      const { data: spaceData, error: spaceErr } = await supabase
        .from('spaces')
        .select(`
          id, space_label, is_front, reserved_for_id,
          reserved_for:staff!spaces_reserved_for_id_fkey ( id, name, initials ),
          row:space_rows ( id, row_label, row_order, row_type )
        `)
        .eq('organisation_id', ORG_ID)
        .eq('is_active', true)
        .order('row_order', { referencedTable: 'space_rows', ascending: true })

      if (spaceErr) throw spaceErr

      // Allocations for the week — FK hint to resolve ambiguity
      const { data: allocData, error: allocErr } = await supabase
        .from('allocations')
        .select(`
          id, space_id, date, is_confirmed, note,
          staff:staff!allocations_staff_id_fkey (
            id, name, initials, role_label,
            priority_access, staff_type,
            usual_arrival, usual_departure
          )
        `)
        .eq('organisation_id', ORG_ID)
        .gte('date', weekStart)
        .lte('date', weekEnd)

      if (allocErr) throw allocErr

      // Roster for the week — who is in / on-call each day
      const { data: rosterData, error: rosterErr } = await supabase
        .from('daily_roster')
        .select(`
          id, date, status, arrival_time, departure_time,
          staff:staff!daily_roster_staff_id_fkey (
            id, name, initials, role_label, staff_type, priority_access
          )
        `)
        .eq('organisation_id', ORG_ID)
        .gte('date', weekStart)
        .lte('date', weekEnd)

      if (rosterErr) throw rosterErr

      setSpaces(spaceData   || [])
      setAllocations(allocData || [])
      setRoster(rosterData  || [])

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  useEffect(() => { fetch() }, [fetch])

  return { spaces, allocations, roster, loading, error, refetch: fetch }
}

// ── Helpers ──────────────────────────────────────────────────

export function getWeekStart(offset = 0) {
  // Returns the Monday of the current week + offset weeks, as ISO string
  const d = new Date()
  const day = d.getDay() // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day // adjust to Monday
  d.setDate(d.getDate() + diff + offset * 7)
  d.setHours(0,0,0,0)
  return d.toISOString().split('T')[0]
}

export function getWeekEnd(weekStart) {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + 4) // Mon + 4 = Fri
  return d.toISOString().split('T')[0]
}

export function getWeekDays(weekStart) {
  // Returns array of 5 ISO date strings Mon–Fri
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

export function formatWeekLabel(weekStart) {
  const d = new Date(weekStart)
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 4)
  return d.toLocaleDateString('en-GB', { day:'numeric', month:'short' })
    + ' – '
    + end.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
}
