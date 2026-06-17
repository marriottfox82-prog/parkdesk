// useDailyView
// Fetches everything needed for the daily view:
//   - All spaces with their row info
//   - Today's allocations joined to staff
//   - Today's roster (who is in / on-call)
//   - Pending move requests
// Returns loading, error, and structured data ready for the UI.

import { useEffect, useState, useCallback } from 'react'
import { supabase, ORG_ID } from '../lib/supabase'

export function useDailyView(date) {
  const [spaces,       setSpaces]       = useState([])
  const [roster,       setRoster]       = useState([])
  const [moveRequests, setMoveRequests] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // All rows + spaces for this org, ordered front to back
      const { data: spaceData, error: spaceErr } = await supabase
        .from('spaces')
        .select(`
          id, space_label, is_front,
          reserved_for_id,
          reserved_for:staff!reserved_for_id ( id, name, initials ),
          row:space_rows ( id, row_label, row_order, row_type )
        `)
        .eq('organisation_id', ORG_ID)
        .eq('is_active', true)
        .order('row_order', { referencedTable: 'space_rows', ascending: true })

      if (spaceErr) throw spaceErr

      // Today's allocations
      const { data: allocData, error: allocErr } = await supabase
        .from('allocations')
        .select(`
           id, space_id, is_confirmed, note,
    staff:staff!allocations_staff_id_fkey ( id, name, initials, role_label, priority_access,
                  usual_arrival, usual_departure )
        `)
        .eq('organisation_id', ORG_ID)
        .eq('date', date)

      if (allocErr) throw allocErr

      // Today's roster
      const { data: rosterData, error: rosterErr } = await supabase
        .from('daily_roster')
        .select(`
           id, status, arrival_time, departure_time,
    staff:staff!daily_roster_staff_id_fkey ( id, name, initials, role_label, staff_type,
                priority_access, usual_arrival, usual_departure )
        `)
        .eq('organisation_id', ORG_ID)
        .eq('date', date)

      if (rosterErr) throw rosterErr

      // Pending move requests
      const { data: moveData, error: moveErr } = await supabase
        .from('move_requests')
        .select(`
          id, status, note, requested_at,
          mover:staff!mover_staff_id ( id, name, initials ),
          mover_space:spaces!mover_space_id ( id, space_label ),
          caller:staff!caller_staff_id ( id, name, initials ),
          caller_space:spaces!caller_space_id ( id, space_label )
        `)
        .eq('organisation_id', ORG_ID)
        .in('status', ['pending', 'snoozed'])
        .order('requested_at', { ascending: false })

      if (moveErr) throw moveErr

      // Merge allocations into spaces
      const allocBySpaceId = Object.fromEntries(
        (allocData || []).map(a => [a.space_id, a])
      )

      const enrichedSpaces = (spaceData || []).map(sp => ({
        ...sp,
        allocation: allocBySpaceId[sp.id] || null,
      }))

      setSpaces(enrichedSpaces)
      setRoster(rosterData || [])
      setMoveRequests(moveData || [])

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { fetch() }, [fetch])

  return { spaces, roster, moveRequests, loading, error, refetch: fetch }
}
