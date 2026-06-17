// useWeeklyPlan
// Fetches allocations for a given week (Mon–Fri).

import { useEffect, useState, useCallback } from 'react'
import { supabase, ORG_ID } from '../lib/supabase'

export function useWeeklyPlan(weekStart) {
  // weekStart: ISO date string for Monday e.g. '2026-06-16'
  const [allocations, setAllocations] = useState([])
  const [spaces,      setSpaces]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  const weekEnd = getWeekEnd(weekStart)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: spaceData, error: spaceErr } = await supabase
        .from('spaces')
        .select(`
          id, space_label, is_front, reserved_for_id,
          reserved_for:staff!reserved_for_id ( id, name, initials ),
          row:space_rows ( id, row_label, row_order )
        `)
        .eq('organisation_id', ORG_ID)
        .eq('is_active', true)
        .order('row_order', { referencedTable: 'space_rows', ascending: true })

      if (spaceErr) throw spaceErr

      const { data: allocData, error: allocErr } = await supabase
        .from('allocations')
        .select(`
          id, space_id, date, is_confirmed, note,
          staff:staff ( id, name, initials, role_label,
                        priority_access, staff_type )
        `)
        .eq('organisation_id', ORG_ID)
        .gte('date', weekStart)
        .lte('date', weekEnd)

      if (allocErr) throw allocErr

      setSpaces(spaceData || [])
      setAllocations(allocData || [])

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  useEffect(() => { fetch() }, [fetch])

  return { spaces, allocations, loading, error, refetch: fetch }
}

function getWeekEnd(weekStart) {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + 4) // Mon + 4 = Fri
  return d.toISOString().split('T')[0]
}
