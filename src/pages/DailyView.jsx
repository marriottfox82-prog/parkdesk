import { useDailyView } from '../hooks/useDailyView'
import { useMoveRequest, acknowledgeMoveRequest, snoozeMoveRequest } from '../hooks/useMoveRequest'
import { useAuth } from '../lib/AuthContext'
import { supabase, ORG_ID } from '../lib/supabase'
import { useState, useCallback } from 'react'

// Use live date — seed data is for 2026-06-17 so override for demo if needed
const today = new Date().toISOString().split('T')[0]

export default function DailyView() {
  const { staffRow, permissions } = useAuth()
  const { spaces, roster, moveRequests, loading, error, refetch } = useDailyView(today)
  const [activeRequest,  setActiveRequest]  = useState(null)
  const [sendingNotify,  setSendingNotify]  = useState(null) // spaceId being notified
  const [notifySuccess,  setNotifySuccess]  = useState(null) // { name, space }

  const handleRequest = useCallback((req) => {
    setActiveRequest(req)
    playAlert()
    showBrowserNotification(req)
  }, [])

  useMoveRequest({ staffId: staffRow?.id, onRequest: handleRequest })

  if (loading) return <div style={centreStyle}>Loading…</div>
  if (error)   return <div style={centreStyle}>Error: {error}</div>

  const rows = groupByRow(spaces)
  const date = new Date(today).toLocaleDateString('en-GB', {
    weekday:'long', day:'numeric', month:'long', year:'numeric'
  })

  const inCount       = roster.filter(r => r.status === 'in').length
  const oncallCount   = roster.filter(r => r.status === 'oncall').length
  const absentCount   = roster.filter(r => ['absent','wfh'].includes(r.status)).length
  const assignedCount = spaces.filter(s => s.allocation).length
  const conflictCount = moveRequests.length

  // Detect which back spaces are blocked and need a notify button
  // back space is blocked if: it has an allocation AND the front space also has an allocation
  // AND back person leaves before front person
  const blockedBackSpaces = new Set()
  rows.forEach(row => {
    const front = row.spaces.find(s => s.is_front)
    const back  = row.spaces.find(s => !s.is_front)
    if (!front?.allocation || !back?.allocation) return
    const frontDep = front.allocation.staff?.usual_departure
    const backDep  = back.allocation.staff?.usual_departure
    if (frontDep && backDep && backDep <= frontDep) {
      blockedBackSpaces.add(back.id)
    }
  })

  async function sendMoveRequest(backSpace, frontSpace) {
    if (!staffRow) return
    setSendingNotify(backSpace.id)
    const moverStaff  = backSpace.allocation?.staff
    const callerStaff = frontSpace?.allocation?.staff ?? backSpace.allocation?.staff

    const note = `${moverStaff?.name} needs to exit ${backSpace.space_label}. Please move your car from ${frontSpace?.space_label ?? backSpace.space_label} as soon as possible.`

    const { error } = await supabase
      .from('move_requests')
      .insert({
        organisation_id: ORG_ID,
        mover_staff_id:  frontSpace?.allocation?.staff?.id ?? backSpace.allocation?.staff?.id,
        mover_space_id:  frontSpace?.id ?? backSpace.id,
        caller_staff_id: moverStaff?.id,
        caller_space_id: backSpace.id,
        status:          'pending',
        requested_by:    staffRow.id,
        note,
      })

    setSendingNotify(null)
    if (!error) {
      setNotifySuccess({ name: frontSpace?.allocation?.staff?.name ?? 'Staff member',
                         space: frontSpace?.space_label ?? backSpace.space_label })
      setTimeout(() => setNotifySuccess(null), 5000)
      refetch()
    }
  }

  return (
    <div style={{ display:'grid', gridTemplateRows:'auto 1fr', height:'100%', overflow:'hidden' }}>

      {/* Status bar */}
      <div style={{ background:'var(--surface)', borderBottom:'0.5px solid var(--border)',
                    padding:'8px 16px', display:'flex', alignItems:'center', gap:16,
                    flexShrink:0 }}>
        <span style={{ fontSize:13, fontWeight:600, color:'var(--text)', letterSpacing:'-0.2px' }}>
          {date}
        </span>
        <div style={{ marginLeft:'auto', display:'flex', gap:16 }}>
          <StatPill dot="var(--green)"    label={`${inCount} in today`} />
          <StatPill dot="var(--amber-mid)" label={`${oncallCount} on-call`} />
          <StatPill dot="#bbb"            label={`${absentCount} not in`} />
          <StatPill dot="var(--green)"    label={`${assignedCount} assigned`} />
          {conflictCount > 0 &&
            <StatPill dot="var(--red)" label={`${conflictCount} pending`} />}
        </div>
      </div>

      {/* Body */}
      <div style={{ display:'grid', gridTemplateColumns:'200px 1fr',
                    overflow:'hidden', minHeight:0 }}>

        <aside style={{ borderRight:'0.5px solid var(--border)', background:'var(--surface)',
                        padding:'14px 10px', overflowY:'auto' }}>
          <Roster roster={roster} />
        </aside>

        <main style={{ overflowY:'auto', padding:16 }}>

          {/* Notification sent confirmation */}
          {notifySuccess && (
            <div style={{ background:'var(--green-light)', border:'0.5px solid #80d0b0',
                          borderRadius:'var(--radius)', padding:'10px 14px',
                          marginBottom:12, display:'flex', gap:8, alignItems:'center',
                          fontSize:13, color:'var(--green-dark)' }}>
              <span>🔔</span>
              <span>
                Notification sent to <strong>{notifySuccess.name}</strong> — please move
                your car from space {notifySuccess.space}.
              </span>
            </div>
          )}

          {/* Active move request — shown to the person who needs to move */}
          {activeRequest && (
            <MoveRequestBanner
              request={activeRequest}
              onAck={async () => {
                await acknowledgeMoveRequest(activeRequest.id)
                setActiveRequest(null)
                refetch()
              }}
              onSnooze={async () => {
                await snoozeMoveRequest(activeRequest.id)
                setActiveRequest(null)
              }}
            />
          )}

          {/* Pending requests — shown to reception */}
          {moveRequests.length > 0 && !activeRequest && (
            <PendingRequestsBanner requests={moveRequests} onRefetch={refetch} />
          )}

          {/* Lot grid */}
          <LotGrid
            rows={rows}
            roster={roster}
            blockedBackSpaces={blockedBackSpaces}
            canNotify={permissions?.can_send_move_requests ?? false}
            sendingNotify={sendingNotify}
            onNotify={sendMoveRequest}
          />

          <Legend />
        </main>
      </div>
    </div>
  )
}

// ── Status pill ──────────────────────────────────────────────

function StatPill({ dot, label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5,
                  fontSize:12, color:'var(--text-2)' }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:dot,
                     display:'inline-block', flexShrink:0 }} />
      {label}
    </div>
  )
}

// ── Sidebar roster ───────────────────────────────────────────

function Roster({ roster }) {
  const oncall  = roster.filter(r => r.status === 'oncall')
  const inToday = roster.filter(r => r.status === 'in')
  const absent  = roster.filter(r => ['absent','wfh'].includes(r.status))
  return (
    <>
      {oncall.length > 0 && <StaffGroup label="On-call doctors" items={oncall} amber />}
      <StaffGroup label="In today" items={inToday} />
      {absent.length > 0 && <StaffGroup label="Not in" items={absent} muted />}
    </>
  )
}

function StaffGroup({ label, items, amber, muted }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:10, fontWeight:600, color:'var(--text-3)',
                    textTransform:'uppercase', letterSpacing:'.06em', margin:'0 4px 7px' }}>
        {label}
      </div>
      {items.map(r => (
        <div key={r.id} style={{ display:'flex', alignItems:'center', gap:7,
                                  padding:'6px 8px', borderRadius:'var(--radius)', marginBottom:1 }}>
          <div style={{ width:27, height:27, borderRadius:'50%', flexShrink:0,
                        background: amber ? 'var(--amber-light)' : muted ? '#f0efeb' : 'var(--green-light)',
                        color:      amber ? 'var(--amber)'       : muted ? '#888'    : 'var(--green-dark)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:10, fontWeight:600 }}>
            {r.staff.initials}
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:12, color: muted ? 'var(--text-3)' : 'var(--text)',
                          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {r.staff.name}
            </div>
            <div style={{ fontSize:10, color:'var(--text-3)', fontFamily:'var(--mono)' }}>
              {muted
                ? (r.status === 'wfh' ? 'WFH' : 'Absent')
                : formatTime(r.arrival_time ?? r.staff.usual_arrival)
                  + (r.departure_time ?? r.staff.usual_departure
                      ? ' – ' + formatTime(r.departure_time ?? r.staff.usual_departure) : '')
              }
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Lot grid ─────────────────────────────────────────────────

function LotGrid({ rows, roster, blockedBackSpaces, canNotify, sendingNotify, onNotify }) {
  return (
    <div style={{ background:'var(--surface)', border:'0.5px solid var(--border)',
                  borderRadius:'var(--radius-lg)', padding:14, marginBottom:12 }}>
      <div style={{ display:'flex', alignItems:'center', marginBottom:12 }}>
        <span style={{ fontSize:13, fontWeight:600, color:'var(--text)', flex:1 }}>Car park</span>
        <span style={{ fontSize:11, color:'var(--text-3)' }}>
          Entrance at top — front spaces exit freely
        </span>
      </div>
      <div style={{ textAlign:'center', fontSize:11, color:'var(--text-3)',
                    border:'0.5px dashed var(--border-med)', borderRadius:'var(--radius)',
                    padding:'5px', marginBottom:12 }}>
        ▼ Entrance / exit
      </div>
      {rows.map(row => (
        <LotRow
          key={row.rowId}
          row={row}
          roster={roster}
          blockedBackSpaces={blockedBackSpaces}
          canNotify={canNotify}
          sendingNotify={sendingNotify}
          onNotify={onNotify}
        />
      ))}
    </div>
  )
}

function LotRow({ row, roster, blockedBackSpaces, canNotify, sendingNotify, onNotify }) {
  const front = row.spaces.find(s => s.is_front)
  const back  = row.spaces.find(s => !s.is_front)

  function isOncall(space) {
    if (!space?.allocation) return false
    return roster.some(r => r.staff.id === space.allocation.staff?.id && r.status === 'oncall')
  }

  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ fontSize:10, color:'var(--text-3)', marginBottom:4, paddingLeft:2 }}>
        {row.rowLabel}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
        <div>
          <div style={{ fontSize:9, color:'var(--text-3)', textAlign:'center', marginBottom:3 }}>
            front — free exit
          </div>
          {front && <SpaceCell space={front} isOncall={isOncall(front)} />}
        </div>
        <div>
          <div style={{ fontSize:9, color:'var(--text-3)', textAlign:'center', marginBottom:3 }}>
            back — needs front clear to exit
          </div>
          {back && (
            <SpaceCell
              space={back}
              isOncall={isOncall(back)}
              isBlocked={blockedBackSpaces.has(back.id)}
              canNotify={canNotify}
              sending={sendingNotify === back.id}
              onNotify={canNotify ? () => onNotify(back, front) : null}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function SpaceCell({ space, isOncall, isBlocked, canNotify, sending, onNotify }) {
  const alloc      = space.allocation
  const isReserved = !!space.reserved_for_id
  const person     = alloc?.staff ?? space.reserved_for

  const bg = isBlocked    ? 'var(--red-light)'
    : !person             ? 'var(--bg)'
    : isReserved          ? 'var(--purple-light)'
    : isOncall            ? 'var(--amber-light)'
    : 'var(--green-light)'

  const borderColor = isBlocked ? '#f09090'
    : !person               ? 'var(--border)'
    : isReserved            ? '#b0a8e0'
    : isOncall              ? 'var(--amber-mid)'
    : '#80d0b0'

  const nameColor = isBlocked  ? 'var(--red)'
    : isReserved               ? 'var(--purple)'
    : isOncall                 ? 'var(--amber)'
    : 'var(--text)'

  return (
    <div style={{ borderRadius:'var(--radius)', border:`0.5px solid ${borderColor}`,
                  background:bg, padding:'8px 9px', minHeight:72,
                  display:'flex', flexDirection:'column', position:'relative' }}>

      <span style={{ fontSize:9, color:'var(--text-3)', fontFamily:'var(--mono)',
                     position:'absolute', top:5, left:7 }}>
        {space.space_label}
      </span>

      {isReserved && !isBlocked && (
        <span style={{ position:'absolute', top:4, right:6, fontSize:9,
                       background:'var(--purple-light)', color:'var(--purple)',
                       padding:'1px 6px', borderRadius:3, fontWeight:500,
                       border:'0.5px solid #b0a8e0' }}>
          reserved
        </span>
      )}
      {isOncall && !isReserved && !isBlocked && (
        <span style={{ position:'absolute', top:4, right:6, fontSize:9,
                       background:'var(--amber-light)', color:'var(--amber)',
                       padding:'1px 5px', borderRadius:3, fontWeight:500 }}>
          on-call
        </span>
      )}
      {isBlocked && (
        <span style={{ position:'absolute', top:4, right:6, fontSize:9,
                       background:'var(--red-light)', color:'var(--red)',
                       padding:'1px 5px', borderRadius:3, fontWeight:500 }}>
          ⚠ blocked
        </span>
      )}

      <div style={{ marginTop:18 }}>
        {person
          ? <>
              <div style={{ fontSize:12, fontWeight:600, color:nameColor,
                            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {person.name}
              </div>
              <div style={{ fontSize:10, color:'var(--text-2)', fontFamily:'var(--mono)', marginTop:2 }}>
                {isReserved && !alloc
                  ? 'reserved — no allocation'
                  : isReserved && alloc
                    ? `reserved · ${formatTime(alloc.staff?.usual_arrival)}`
                    : formatTime(alloc?.staff?.usual_arrival)
                      + (alloc?.staff?.usual_departure
                          ? ' – ' + formatTime(alloc.staff.usual_departure) : '')
                }
              </div>
              {isBlocked && canNotify && (
                <button
                  onClick={onNotify}
                  disabled={sending}
                  style={{ marginTop:6, fontSize:10, padding:'3px 8px',
                           borderRadius:'var(--radius)', border:'0.5px solid var(--red)',
                           background:'var(--red-light)', color:'var(--red)',
                           cursor: sending ? 'wait' : 'pointer', fontFamily:'inherit',
                           display:'inline-flex', alignItems:'center', gap:4 }}>
                  {sending ? '…sending' : '🔔 Notify to move'}
                </button>
              )}
            </>
          : <>
              <div style={{ fontSize:11, color:'var(--text-3)' }}>Empty</div>
              <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2 }}>
                Available to assign
              </div>
            </>
        }
      </div>
    </div>
  )
}

// ── Banners ──────────────────────────────────────────────────

function MoveRequestBanner({ request, onAck, onSnooze }) {
  return (
    <div style={{ background:'var(--amber-light)', border:'0.5px solid var(--amber-mid)',
                  borderRadius:'var(--radius)', padding:'12px 14px',
                  marginBottom:12, display:'flex', gap:10, alignItems:'flex-start' }}>
      <span style={{ fontSize:18, flexShrink:0 }}>🔔</span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--amber)', marginBottom:3 }}>
          Please move your car
        </div>
        <div style={{ fontSize:12, color:'var(--amber)', lineHeight:1.5, marginBottom:10 }}>
          {request.note}
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={onSnooze} style={btnStyle}>Snooze 5 min</button>
          <button onClick={onAck}
            style={{ ...btnStyle, background:'var(--green)', color:'#fff',
                     borderColor:'var(--green)', fontWeight:500 }}>
            ✓ On my way
          </button>
        </div>
      </div>
    </div>
  )
}

function PendingRequestsBanner({ requests, onRefetch }) {
  return (
    <div style={{ background:'var(--red-light)', border:'0.5px solid #f09090',
                  borderRadius:'var(--radius)', padding:'10px 14px',
                  marginBottom:12, display:'flex', gap:10, alignItems:'center' }}>
      <span style={{ fontSize:16 }}>⚠️</span>
      <div style={{ flex:1, fontSize:13, color:'var(--red)', lineHeight:1.5 }}>
        <strong>{requests.length} move request{requests.length > 1 ? 's' : ''} pending</strong>
        {' '}— {requests.map(r => r.mover_space?.space_label ?? '?').join(', ')}.
        Use the notify button on the blocked space.
      </div>
      <button onClick={onRefetch} style={{ ...btnStyle, flexShrink:0 }}>Refresh</button>
    </div>
  )
}

// ── Legend ───────────────────────────────────────────────────

function Legend() {
  const items = [
    { bg:'var(--purple-light)', border:'#b0a8e0',        label:'Reserved',     desc:'Locked to a named person' },
    { bg:'var(--amber-light)',  border:'var(--amber-mid)',label:'On-call',      desc:'Must stay in a front space' },
    { bg:'var(--green-light)',  border:'#80d0b0',         label:'Fixed staff',  desc:'Pre-allocated from the plan' },
    { bg:'var(--red-light)',    border:'#f09090',         label:'⚠ Blocked',   desc:'Cannot exit — front space occupied later' },
    { bg:'var(--bg)',           border:'var(--border)',   label:'Empty',        desc:'Available to assign' },
  ]
  return (
    <div style={{ background:'var(--surface)', border:'0.5px solid var(--border)',
                  borderRadius:'var(--radius-lg)', padding:'12px 14px' }}>
      <div style={{ fontSize:10, fontWeight:600, color:'var(--text-3)',
                    textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
        Colour key
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
        {items.map(item => (
          <div key={item.label} style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:28, height:18, borderRadius:3, flexShrink:0,
                          background:item.bg, border:`0.5px solid ${item.border}` }} />
            <span style={{ fontSize:12, fontWeight:500, color:'var(--text)' }}>{item.label}</span>
            <span style={{ fontSize:11, color:'var(--text-3)' }}>{item.desc}</span>
          </div>
        ))}
        <div style={{ display:'flex', alignItems:'center', gap:10, paddingTop:6,
                      borderTop:'0.5px solid var(--border)', marginTop:2 }}>
          <span style={{ fontSize:9, padding:'1px 6px', borderRadius:3,
                         border:'0.5px solid #b0a8e0', background:'var(--purple-light)',
                         color:'var(--purple)', fontWeight:500, flexShrink:0 }}>
            reserved
          </span>
          <span style={{ fontSize:12, fontWeight:500, color:'var(--text)' }}>Reserved badge</span>
          <span style={{ fontSize:11, color:'var(--text-3)' }}>
            Space is permanently assigned — algorithm will not change this
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:10, padding:'2px 7px', borderRadius:3,
                         border:'0.5px solid var(--red)', background:'var(--red-light)',
                         color:'var(--red)', width:28, textAlign:'center', flexShrink:0 }}>
            🔔
          </span>
          <span style={{ fontSize:12, fontWeight:500, color:'var(--text)' }}>Notify to move</span>
          <span style={{ fontSize:11, color:'var(--text-3)' }}>
            Sends an audible alert to the front-space occupant's browser tab
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────

function formatTime(t) {
  if (!t) return ''
  return t.slice(0, 5)
}

function groupByRow(spaces) {
  const map = {}
  spaces.forEach(sp => {
    const rowId = sp.row.id
    if (!map[rowId]) map[rowId] = {
      rowId, rowLabel: sp.row.row_label, rowOrder: sp.row.row_order, spaces: []
    }
    map[rowId].spaces.push(sp)
  })
  return Object.values(map).sort((a, b) => a.rowOrder - b.rowOrder)
}

function playAlert() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 880; osc.type = 'sine'
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.7)
  } catch (e) {}
}

async function showBrowserNotification(req) {
  if (!('Notification' in window)) return
  if (Notification.permission === 'default') await Notification.requestPermission()
  if (Notification.permission === 'granted') {
    new Notification('Please move your car — ParkDesk', {
      body: req.note ?? 'Reception has requested you move your car.',
      icon: '/favicon.ico',
    })
  }
}

const centreStyle = {
  display:'flex', alignItems:'center', justifyContent:'center',
  height:'100%', fontSize:13, color:'var(--text-3)'
}
const btnStyle = {
  fontSize:12, padding:'5px 10px', borderRadius:'var(--radius)',
  border:'0.5px solid var(--border-med)', background:'var(--surface)',
  color:'var(--text)', cursor:'pointer', fontFamily:'inherit'
}
