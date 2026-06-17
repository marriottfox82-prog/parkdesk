import { useState } from 'react'
import { useWeeklyPlan, getWeekStart, getWeekDays, formatWeekLabel } from '../hooks/useWeeklyPlan'

// Seed week hard-coded to match data — switch to getWeekStart() for live use
const SEED_WEEK = '2026-06-16'

export default function WeeklyPlan() {
  const [weekOffset, setWeekOffset] = useState(0)

  // Use seed week for offset 0, calculate from real date for others
  const weekStart = weekOffset === 0
    ? SEED_WEEK
    : getWeekStart(weekOffset)

  const { spaces, allocations, roster, loading, error } = useWeeklyPlan(weekStart)

  const days    = getWeekDays(weekStart)
  const dayNames = ['Mon','Tue','Wed','Thu','Fri']

  if (loading) return <div style={centreStyle}>Loading…</div>
  if (error)   return <div style={centreStyle}>Error: {error}</div>

  // Build lookup: allocBySpaceDate[spaceId][date] = allocation
  const allocBySpaceDate = {}
  allocations.forEach(a => {
    if (!allocBySpaceDate[a.space_id]) allocBySpaceDate[a.space_id] = {}
    allocBySpaceDate[a.space_id][a.date] = a
  })

  // Build lookup: oncallByDate[date] = Set of staff IDs on-call
  const oncallByDate = {}
  roster.forEach(r => {
    if (r.status === 'oncall') {
      if (!oncallByDate[r.date]) oncallByDate[r.date] = new Set()
      oncallByDate[r.date].add(r.staff.id)
    }
  })

  // Group spaces by row
  const rows = groupByRow(spaces)

  // Detect conflicts: back space leaves after front space on same day
  const conflicts = detectConflicts(rows, allocBySpaceDate, days)

  // Stats
  const totalAssigned = allocations.length
  const totalConflicts = Object.keys(conflicts).length
  const resolvedDays = days.filter(d =>
    !Object.keys(conflicts).some(k => k.endsWith('|' + d))
  ).length

  return (
    <div style={{ display:'grid', gridTemplateRows:'auto auto 1fr', height:'100%', overflow:'hidden' }}>

      {/* Top bar */}
      <div style={{ background:'var(--surface)', borderBottom:'0.5px solid var(--border)',
                    padding:'9px 16px', display:'flex', alignItems:'center', gap:10,
                    flexShrink:0 }}>
        <button style={btnStyle} onClick={() => setWeekOffset(o => o - 1)}>‹</button>
        <span style={{ fontSize:14, fontWeight:600, letterSpacing:'-0.2px',
                       color:'var(--text)', flex:1, textAlign:'center' }}>
          {formatWeekLabel(weekStart)}
        </span>
        <button style={btnStyle} onClick={() => setWeekOffset(o => o + 1)}>›</button>
        <div style={{ width:1, height:20, background:'var(--border)', margin:'0 6px' }} />
        <StatPill dot="var(--green)"    label={`${resolvedDays} days resolved`} />
        <StatPill dot="var(--red)"      label={`${totalConflicts} conflict${totalConflicts !== 1 ? 's' : ''}`} />
        <StatPill dot="var(--text-3)"   label={`${totalAssigned} assigned`} />
      </div>

      {/* Conflict banner — shown if any conflicts exist */}
      {totalConflicts > 0 && (
        <div style={{ background:'var(--red-light)', borderBottom:'0.5px solid #f09090',
                      padding:'8px 16px', display:'flex', gap:8, alignItems:'center',
                      fontSize:12, color:'var(--red)', flexShrink:0 }}>
          <span style={{ fontSize:15 }}>⚠️</span>
          <span>
            <strong>{totalConflicts} blocking conflict{totalConflicts !== 1 ? 's' : ''} this week</strong>
            {' '}— back-space occupants may not be able to exit freely.
            Review highlighted cells and swap spaces to resolve.
          </span>
        </div>
      )}

      {/* Grid */}
      <div style={{ overflow:'auto', padding:14 }}>
        <div style={{
          display:'grid',
          gridTemplateColumns:`100px repeat(${days.length}, minmax(120px, 1fr))`,
          gap:5,
          minWidth:720,
        }}>

          {/* Corner */}
          <div />

          {/* Day headers */}
          {days.map((date, i) => {
            const hasConflict = Object.keys(conflicts).some(k => k.endsWith('|' + date))
            const d = new Date(date)
            return (
              <div key={date} style={{
                background:'var(--surface)', border:`0.5px solid ${hasConflict ? '#f09090' : 'var(--border)'}`,
                borderRadius:'var(--radius)', padding:'8px 10px', textAlign:'center',
              }}>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>
                  {dayNames[i]}
                </div>
                <div style={{ fontSize:11, color:'var(--text-3)', fontFamily:'var(--mono)' }}>
                  {d.toLocaleDateString('en-GB', { day:'numeric', month:'short' })}
                </div>
                <div style={{ fontSize:10, marginTop:3,
                              color: hasConflict ? 'var(--red)' : 'var(--green-dark)',
                              display:'flex', alignItems:'center', justifyContent:'center', gap:3 }}>
                  {hasConflict ? '⚠ conflict' : '✓ resolved'}
                </div>
              </div>
            )
          })}

          {/* Rows */}
          {rows.map(row => {
            const front = row.spaces.find(s => s.is_front)
            const back  = row.spaces.find(s => !s.is_front)

            return [front, back].filter(Boolean).map(space => (
              <>
                {/* Row label — only show for front space */}
                {space.is_front
                  ? <div key={`lbl-${space.id}`} style={{
                      background:'var(--surface)', border:'0.5px solid var(--border)',
                      borderRadius:'var(--radius)', padding:'6px 8px',
                      display:'flex', flexDirection:'column', justifyContent:'center',
                      gridRow: `span 1`,
                    }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'var(--text)' }}>
                        {row.rowLabel}
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-3)' }}>
                        front
                      </div>
                      {space.reserved_for_id && (
                        <div style={{ fontSize:10, color:'var(--purple)', marginTop:2 }}>
                          🔒 {space.reserved_for?.name?.split(' ').pop()}
                        </div>
                      )}
                    </div>
                  : <div key={`lbl-back-${space.id}`} style={{
                      background:'var(--surface)', border:'0.5px solid var(--border)',
                      borderRadius:'var(--radius)', padding:'6px 8px',
                      display:'flex', flexDirection:'column', justifyContent:'center',
                    }}>
                      <div style={{ fontSize:10, color:'var(--text-3)' }}>
                        {row.rowLabel} back
                      </div>
                      {space.reserved_for_id && (
                        <div style={{ fontSize:10, color:'var(--purple)', marginTop:2 }}>
                          🔒 {space.reserved_for?.name?.split(' ').pop()}
                        </div>
                      )}
                    </div>
                }

                {/* Cells for each day */}
                {days.map(date => {
                  const alloc   = allocBySpaceDate[space.id]?.[date]
                  const isOncall = alloc && oncallByDate[date]?.has(alloc.staff?.id)
                  const isConflict = !!conflicts[`${space.id}|${date}`]
                  const isReserved = !!space.reserved_for_id

                  return (
                    <PlanCell
                      key={`${space.id}|${date}`}
                      space={space}
                      alloc={alloc}
                      isOncall={isOncall}
                      isConflict={isConflict}
                      isReserved={isReserved}
                    />
                  )
                })}
              </>
            ))
          })}
        </div>

        {/* Legend */}
        <Legend />
      </div>
    </div>
  )
}

// ── Plan cell ────────────────────────────────────────────────

function PlanCell({ space, alloc, isOncall, isConflict, isReserved }) {
  const person = alloc?.staff ?? (isReserved ? space.reserved_for : null)

  const bg = isConflict    ? 'var(--red-light)'
    : !person              ? 'var(--bg)'
    : isReserved           ? 'var(--purple-light)'
    : isOncall             ? 'var(--amber-light)'
    : 'var(--green-light)'

  const borderColor = isConflict ? '#f09090'
    : !person              ? 'var(--border)'
    : isReserved           ? '#b0a8e0'
    : isOncall             ? 'var(--amber-mid)'
    : '#80d0b0'

  const nameColor = isConflict   ? 'var(--red)'
    : isReserved                 ? 'var(--purple)'
    : isOncall                   ? 'var(--amber)'
    : 'var(--text)'

  return (
    <div style={{
      borderRadius:'var(--radius)', border:`0.5px solid ${borderColor}`,
      background:bg, padding:'6px 8px', minHeight:52,
      display:'flex', flexDirection:'column', gap:2,
    }}>
      {person
        ? <>
            <div style={{ fontSize:11, fontWeight:600, color:nameColor,
                          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {person.name?.split(' ').pop()} {/* surname only to save space */}
            </div>
            <div style={{ fontSize:10, color:'var(--text-2)', fontFamily:'var(--mono)' }}>
              {isReserved && !alloc
                ? 'reserved'
                : formatTime(alloc?.staff?.usual_arrival)
              }
            </div>
            {isConflict && (
              <div style={{ fontSize:9, color:'var(--red)', fontWeight:500, marginTop:2 }}>
                ⚠ blocking conflict
              </div>
            )}
            {isOncall && !isConflict && (
              <div style={{ fontSize:9, color:'var(--amber)', fontWeight:500 }}>
                on-call
              </div>
            )}
            {alloc?.note === 'Reserved' && (
              <div style={{ fontSize:9, color:'var(--purple)' }}>🔒 reserved</div>
            )}
          </>
        : <div style={{ fontSize:11, color:'var(--text-3)', marginTop:4 }}>—</div>
      }
    </div>
  )
}

// ── Legend ───────────────────────────────────────────────────

function Legend() {
  const items = [
    { bg:'var(--purple-light)', border:'#b0a8e0',       label:'Reserved',    desc:'Locked to a named person' },
    { bg:'var(--amber-light)',  border:'var(--amber-mid)', label:'On-call',   desc:'Must stay in a front space' },
    { bg:'var(--green-light)',  border:'#80d0b0',        label:'Allocated',  desc:'Fixed staff — pre-planned' },
    { bg:'var(--red-light)',    border:'#f09090',        label:'Conflict',   desc:'Back space may be blocked' },
    { bg:'var(--bg)',           border:'var(--border)',  label:'Empty',      desc:'No allocation for this day' },
  ]
  return (
    <div style={{ marginTop:12, background:'var(--surface)', border:'0.5px solid var(--border)',
                  borderRadius:'var(--radius-lg)', padding:'12px 14px' }}>
      <div style={{ fontSize:10, fontWeight:600, color:'var(--text-3)',
                    textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
        Key
      </div>
      <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
        {items.map(item => (
          <div key={item.label} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:24, height:16, borderRadius:3, flexShrink:0,
                          background:item.bg, border:`0.5px solid ${item.border}` }} />
            <span style={{ fontSize:12, fontWeight:500, color:'var(--text)' }}>{item.label}</span>
            <span style={{ fontSize:11, color:'var(--text-3)' }}>{item.desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────

function StatPill({ dot, label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--text-2)' }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:dot,
                     display:'inline-block', flexShrink:0 }} />
      {label}
    </div>
  )
}

function groupByRow(spaces) {
  const map = {}
  spaces.forEach(sp => {
    const rowId = sp.row.id
    if (!map[rowId]) map[rowId] = {
      rowId,
      rowLabel:  sp.row.row_label,
      rowOrder:  sp.row.row_order,
      spaces:    [],
    }
    map[rowId].spaces.push(sp)
  })
  return Object.values(map).sort((a, b) => a.rowOrder - b.rowOrder)
}

function detectConflicts(rows, allocBySpaceDate, days) {
  // A conflict exists when:
  // - A back space has an allocation on a given day
  // - The front space on the same row also has an allocation
  // - The back person's departure is later than (or same as) the front person's departure
  //   (meaning front won't be gone when back needs to leave)
  // OR the front space is reserved but the reserved person isn't in that day
  const conflicts = {}

  rows.forEach(row => {
    const front = row.spaces.find(s => s.is_front)
    const back  = row.spaces.find(s => !s.is_front)
    if (!front || !back) return

    days.forEach(date => {
      const frontAlloc = allocBySpaceDate[front.id]?.[date]
      const backAlloc  = allocBySpaceDate[back.id]?.[date]

      if (!backAlloc) return // no one in back, no conflict possible

      if (!frontAlloc) {
        // Back is occupied but front is empty — back person can exit freely, no conflict
        return
      }

      // Both occupied — check if back person leaves before or at same time as front
      const frontDep = frontAlloc.staff?.usual_departure
      const backDep  = backAlloc.staff?.usual_departure

      if (frontDep && backDep && backDep <= frontDep) {
        // Back leaves first — conflict: front needs to move
        conflicts[`${back.id}|${date}`] = {
          backStaff:  backAlloc.staff?.name,
          frontStaff: frontAlloc.staff?.name,
          date,
        }
      }
    })
  })

  return conflicts
}

function formatTime(t) {
  if (!t) return '—'
  return t.slice(0, 5)
}

const centreStyle = {
  display:'flex', alignItems:'center', justifyContent:'center',
  height:'100%', fontSize:13, color:'var(--text-3)',
}

const btnStyle = {
  fontSize:13, padding:'5px 10px', borderRadius:'var(--radius)',
  border:'0.5px solid var(--border-med)', background:'var(--surface)',
  color:'var(--text)', cursor:'pointer',
}
