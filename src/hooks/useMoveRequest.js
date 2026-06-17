// useMoveRequest
// Supabase Realtime subscription for the staff tab.
// Subscribes to move_requests where mover_staff_id = current user's staff id.
// Fires onRequest callback when a new pending request arrives.

import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useMoveRequest({ staffId, onRequest }) {
  const channelRef = useRef(null)

  useEffect(() => {
    if (!staffId) return

    const channel = supabase
      .channel(`move-requests-${staffId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'move_requests',
          filter: `mover_staff_id=eq.${staffId}`,
        },
        (payload) => {
          if (payload.new?.status === 'pending') {
            onRequest(payload.new)
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [staffId, onRequest])
}

// Acknowledge a move request — called when staff clicks "On my way"
export async function acknowledgeMoveRequest(requestId) {
  return supabase
    .from('move_requests')
    .update({
      status:           'acknowledged',
      acknowledged_at:  new Date().toISOString(),
    })
    .eq('id', requestId)
}

// Snooze — called when staff clicks "Snooze 5 min"
export async function snoozeMoveRequest(requestId, minutes = 5) {
  const until = new Date(Date.now() + minutes * 60 * 1000).toISOString()
  return supabase
    .from('move_requests')
    .update({ status: 'snoozed', snoozed_until: until })
    .eq('id', requestId)
}
