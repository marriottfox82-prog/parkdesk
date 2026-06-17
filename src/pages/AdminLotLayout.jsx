import { useState, useEffect, useCallback } from 'react'
import { supabase, ORG_ID } from '../lib/supabase'

export default function AdminLotLayout() {
  const [rows,    setRows]    = useState([])
  const [staff,   setStaff]   = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState(null)
  const [selected, setSelected] = useState(null) // { spaceId } for editing

  const fetch = useCallback(async () => {
    setLoading(true)
    const [{ data: rowData }, { data: staffData }] = await Promise.all([
      supabase
        .from('space_rows')
        .select(`
          id, row_label, row_order, row_type,
          spaces ( id, space_label, is_front, reserved_for_id,
                   reserved_for:staff!spaces_reserved_for_id_fkey ( id, name ) )
        `)
        .eq('organisation_id', ORG_ID)
        .order('row_order', { ascending: true }),
      supabase
        .from('staff')
        .select('id, name, initials, role_label, mobility_needs')
        .eq('organisation_id', ORG_ID)
        .order('name'),
    ])
    // Sort spaces within each row: front first
    const sorted = (rowData || []).map(r => ({
      ...r,
      spaces: (r.spaces || []).sort((a, b) => (b.is_front ? 1 : 0) - (a.is_front ? 1 : 0))
    }))
    setRows(sorted)
    setStaff(staffData || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  // ── Reorder rows ────────────────────────────────────────────
  async function moveRow(idx, dir) {
    const newRows = [...rows]
    const target = idx + dir
    if (target < 0 || target >= newRows.length) return
    ;[newRows[idx], newRows[target]] = [newRows[target], newRows[idx]]
    // Update row_order values
    const updates = newRows.map((r, i) => ({ id: r.id, row_order: i + 1 }))
    setRows(newRows)
    for (const u of updates) {
      await supabase.from('space_rows').update({ row_order: u.row_order }).eq('id', u.id)
    }
  }

  // ── Add row ──────────────────────────────────────────────────
  async function addRow(type = 'tandem') {
    const nextOrder = rows.length + 1
    const letter = String.fromCharCode(64 + nextOrder) // A, B, C…
    const label  = `Row ${letter}`

    const { data: newRow, error: rowErr } = await supabase
      .from('space_rows')
      .insert({ organisation_id: ORG_ID, row_order: nextOrder, row_label: label, row_type: type })
      .select()
      .single()

    if (rowErr) { setMsg({ type:'err', text: rowErr.message }); return }

    // Insert spaces for the row
    const spaces = type === 'tandem'
      ? [
          { organisation_id: ORG_ID, row_id: newRow.id, space_label: `${letter}1`, is_front: true },
          { organisation_id: ORG_ID, row_id: newRow.id, space_label: `${letter}2`, is_front: false },
        ]
      : [
          { organisation_id: ORG_ID, row_id: newRow.id, space_label: `${letter}`, is_front: true },
        ]

    await supabase.from('spaces').insert(spaces)
    fetch()
  }

  // ── Delete row ───────────────────────────────────────────────
  async function deleteRow(rowId) {
    if (!window.confirm('Delete this row and its spaces? This cannot be undone.')) return
    await supabase.from('spaces').delete().eq('row_id', rowId)
    await supabase.from('space_rows').delete().eq('id', rowId)
    fetch()
  }

  // ── Update row label ─────────────────────────────────────────
  async function updateRowLabel(rowId, label) {
    await supabase.from('space_rows').update({ row_label: label }).eq('id', rowId)
  }

  // ── Update space label ───────────────────────────────────────
  async function updateSpaceLabel(spaceId, label) {
    await supabase.from('spaces').update({ space_label: label }).eq('id', spaceId)
  }

  // ── Update reservation ───────────────────────────────────────
  async function updateReservation(spaceId, staffId) {
    await supabase
      .from('spaces')
      .update({ reserved_for_id: staffId || null })
      .eq('id', spaceId)
    fetch()
    setMsg({ type:'ok', text: 'Reservation updated.' })
    setTimeout(() => setMsg(null), 3000)
  }

  if (loading) return <div style={centreStyle}>Loading lot layout…</div>

  const mainRows     = rows.filter(r => r.row_type !== 'overflow')
  const overflowRows = rows.filter(r => r.row_type === 'overflow')

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', height:'100%',
                  overflow:'hidden', gap:0 }}>

      {/* ── Left: editor ───────────────────────────────────── */}
      <div style={{ overflowY:'auto', padding:'20px 16px',
                    borderRight:'0.5px solid var(--border)' }}>

        <div style={{ marginBottom:20 }}>
          <h2 style={{ fontSize:15, fontWeight:600, letterSpacing:'-0.2px',
                       color:'var(--text)', marginBottom:4 }}>
            Lot layout
          </h2>
          <p style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.5 }}>
            Define rows from entrance (top) to furthest back. Tandem rows have a front
            space that exits freely and a back space that needs the front clear to exit.
            Drag rows to reorder.
          </p>
        </div>

        {msg && (
          <div style={{ ...alertStyle,
                        background: msg.type==='ok' ? 'var(--green-light)' : 'var(--red-light)',
                        borderColor: msg.type==='ok' ? '#80d0b0' : '#f09090',
                        color: msg.type==='ok' ? 'var(--green-dark)' : 'var(--red)',
                        marginBottom:14 }}>
            {msg.text}
          </div>
        )}

        {/* Main spaces */}
        <SectionLabel label="Main car park" />
        <RowList
          rows={mainRows}
          staff={staff}
          selected={selected}
          onSelect={setSelected}
          onMoveRow={moveRow}
          onDeleteRow={deleteRow}
          onUpdateRowLabel={updateRowLabel}
          onUpdateSpaceLabel={updateSpaceLabel}
          onUpdateReservation={updateReservation}
          allRows={rows}
        />
        <div style={{ display:'flex', gap:7, marginTop:10, marginBottom:24 }}>
          <button style={btnStyle} onClick={() => addRow('tandem')}>+ Add tandem row</button>
          <button style={btnStyle} onClick={() => addRow('single')}>+ Add single space</button>
          <button style={btnStyle} onClick={() => addRow('disabled')}>+ Add disabled bay</button>
        </div>

        {/* Overflow spaces */}
        <SectionLabel label="Overflow spaces" />
        <p style={{ fontSize:12, color:'var(--text-2)', marginBottom:10, lineHeight:1.5 }}>
          Overflow spaces are always freely accessible (no tandem blocking).
          The algorithm assigns lower-priority staff here, unless they have a mobility need.
        </p>
        <RowList
          rows={overflowRows}
          staff={staff}
          selected={selected}
          onSelect={setSelected}
          onMoveRow={moveRow}
          onDeleteRow={deleteRow}
          onUpdateRowLabel={updateRowLabel}
          onUpdateSpaceLabel={updateSpaceLabel}
          onUpdateReservation={updateReservation}
          allRows={rows}
        />
        <div style={{ marginTop:10 }}>
          <button style={btnStyle} onClick={() => addRow('overflow')}>+ Add overflow space</button>
        </div>
      </div>

      {/* ── Right: visual preview ──────────────────────────── */}
      <div style={{ overflowY:'auto', padding:'20px 14px',
                    background:'var(--bg)' }}>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)',
                      textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>
          Visual preview
        </div>

        {/* Entrance */}
        <div style={{ textAlign:'center', fontSize:11, color:'var(--text-3)',
                      border:'0.5px dashed var(--border-med)', borderRadius:'var(--radius)',
                      padding:'5px', marginBottom:10 }}>
          ▼ Entrance / exit
        </div>

        {/* Main rows preview */}
        {mainRows.map(row => (
          <PreviewRow key={row.id} row={row} selected={selected} onSelect={setSelected} />
        ))}

        {/* Overflow section */}
        {overflowRows.length > 0 && (
          <>
            <div style={{ fontSize:11, color:'var(--text-3)', textAlign:'center',
                          padding:'6px', margin:'10px 0 6px',
                          borderTop:'0.5px dashed var(--border-med)' }}>
              — Overflow spaces —
            </div>
            {overflowRows.map(row => (
              <PreviewRow key={row.id} row={row} selected={selected} onSelect={setSelected} />
            ))}
          </>
        )}

        {/* Preview legend */}
        <div style={{ marginTop:14, fontSize:11, color:'var(--text-3)',
                      borderTop:'0.5px solid var(--border)', paddingTop:10 }}>
          <div style={{ marginBottom:5, fontWeight:600 }}>Click any space to edit it</div>
          {[
            { bg:'var(--purple-light)', border:'#b0a8e0', label:'Reserved' },
            { bg:'var(--green-light)',  border:'#80d0b0', label:'Tandem front' },
            { bg:'#f5f3ee',            border:'var(--border)', label:'Tandem back' },
            { bg:'var(--blue-light)',   border:'#a0c8f0', label:'Overflow / single' },
          ].map(item => (
            <div key={item.label} style={{ display:'flex', alignItems:'center',
                                           gap:6, marginBottom:4 }}>
              <div style={{ width:20, height:14, borderRadius:2, flexShrink:0,
                            background:item.bg, border:`0.5px solid ${item.border}` }} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Row list (editor) ────────────────────────────────────────

function RowList({ rows, staff, selected, onSelect, onMoveRow, onDeleteRow,
                   onUpdateRowLabel, onUpdateSpaceLabel, onUpdateReservation, allRows }) {
  if (rows.length === 0) {
    return <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:10 }}>None added yet.</div>
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
      {rows.map((row, idx) => {
        const globalIdx = allRows.findIndex(r => r.id === row.id)
        return (
          <div key={row.id} style={{ background:'var(--surface)',
                                      border:'0.5px solid var(--border)',
                                      borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
            {/* Row header */}
            <div style={{ padding:'8px 12px', borderBottom:'0.5px solid var(--border)',
                          display:'flex', alignItems:'center', gap:8,
                          background:'var(--bg)' }}>
              <div style={{ display:'flex', gap:2 }}>
                <button style={iconBtn} onClick={() => onMoveRow(globalIdx, -1)}
                        title="Move up">↑</button>
                <button style={iconBtn} onClick={() => onMoveRow(globalIdx, 1)}
                        title="Move down">↓</button>
              </div>
              <input
                defaultValue={row.row_label}
                onBlur={e => onUpdateRowLabel(row.id, e.target.value)}
                style={{ ...inlineInput, fontWeight:500, flex:1 }}
              />
              <span style={{ fontSize:10, color:'var(--text-3)',
                             background:'var(--bg)', padding:'2px 6px',
                             borderRadius:3, border:'0.5px solid var(--border)',
                             flexShrink:0 }}>
                {row.row_type}
              </span>
              <button
                style={{ ...iconBtn, color:'var(--red)' }}
                onClick={() => onDeleteRow(row.id)}
                title="Delete row">✕</button>
            </div>

            {/* Spaces */}
            <div style={{ padding:'10px 12px', display:'flex', gap:8, flexWrap:'wrap' }}>
              {row.spaces.map(sp => {
                const isSelected = selected?.spaceId === sp.id
                return (
                  <div key={sp.id}>
                    <div
                      onClick={() => onSelect(isSelected ? null : { spaceId: sp.id })}
                      style={{
                        border:`1.5px solid ${isSelected ? 'var(--green)' : 'var(--border-med)'}`,
                        borderRadius:'var(--radius)', padding:'8px 10px',
                        background: isSelected ? 'var(--green-light)' : 'var(--surface)',
                        cursor:'pointer', minWidth:120,
                      }}>
                      <div style={{ fontSize:10, color:'var(--text-3)', marginBottom:4 }}>
                        {sp.is_front
                          ? (row.row_type === 'tandem' ? 'front — free exit' : 'single space')
                          : 'back — needs front clear'}
                      </div>
                      <input
                        defaultValue={sp.space_label}
                        onBlur={e => onUpdateSpaceLabel(sp.id, e.target.value)}
                        onClick={e => e.stopPropagation()}
                        style={{ ...inlineInput, fontWeight:600, width:'100%', marginBottom:4 }}
                        placeholder="Label e.g. A1"
                      />
                      {sp.reserved_for
                        ? <div style={{ fontSize:10, color:'var(--purple)' }}>
                            🔒 {sp.reserved_for.name.split(' ').pop()}
                          </div>
                        : <div style={{ fontSize:10, color:'var(--text-3)' }}>No reservation</div>
                      }
                    </div>

                    {/* Inline reservation editor when selected */}
                    {isSelected && (
                      <div style={{ marginTop:6, padding:'10px', background:'var(--surface)',
                                    border:'0.5px solid var(--green)', borderRadius:'var(--radius)',
                                    minWidth:200 }}>
                        <div style={{ fontSize:11, fontWeight:500, color:'var(--text)',
                                      marginBottom:6 }}>
                          Reserve this space for:
                        </div>
                        <select
                          defaultValue={sp.reserved_for_id ?? ''}
                          onChange={e => onUpdateReservation(sp.id, e.target.value)}
                          style={{ ...inlineInput, width:'100%' }}>
                          <option value="">— No reservation —</option>
                          {staff.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.role_label})</option>
                          ))}
                        </select>
                        <div style={{ fontSize:10, color:'var(--text-3)', marginTop:5,
                                      lineHeight:1.4 }}>
                          Reserved spaces are locked — the algorithm will not reassign them.
                          Override per day in the weekly plan.
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Visual preview row ───────────────────────────────────────

function PreviewRow({ row, selected, onSelect }) {
  const front = row.spaces.find(s => s.is_front)
  const back  = row.spaces.find(s => !s.is_front)
  const isOverflow = row.row_type === 'overflow'
  const isSingle   = row.row_type === 'single' || row.row_type === 'disabled'

  return (
    <div style={{ marginBottom:6 }}>
      <div style={{ fontSize:9, color:'var(--text-3)', marginBottom:3, paddingLeft:2 }}>
        {row.row_label}
      </div>
      <div style={{ display:'grid',
                    gridTemplateColumns: (isSingle || isOverflow) ? '1fr' : '1fr 1fr',
                    gap:4 }}>
        {[front, back].filter(Boolean).map(sp => {
          if (!sp) return null
          const isRes = !!sp.reserved_for_id
          const isSelected = selected?.spaceId === sp.id
          const bg = isSelected   ? 'var(--green-light)'
            : isRes               ? 'var(--purple-light)'
            : isOverflow          ? 'var(--blue-light)'
            : !sp.is_front        ? '#f5f3ee'
            : 'var(--surface)'
          const border = isSelected ? '1.5px solid var(--green)'
            : isRes               ? '0.5px solid #b0a8e0'
            : isOverflow          ? '0.5px solid #a0c8f0'
            : '0.5px solid var(--border)'

          return (
            <div
              key={sp.id}
              onClick={() => onSelect(isSelected ? null : { spaceId: sp.id })}
              style={{ background:bg, border, borderRadius:'var(--radius)',
                       padding:'5px 7px', cursor:'pointer', minHeight:36 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text)' }}>
                {sp.space_label}
              </div>
              <div style={{ fontSize:9, color:'var(--text-3)' }}>
                {isRes ? `🔒 ${sp.reserved_for?.name?.split(' ').pop()}` :
                 sp.is_front ? (isOverflow ? 'overflow' : 'front') : 'back'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Small helpers ────────────────────────────────────────────

function SectionLabel({ label }) {
  return (
    <div style={{ fontSize:10, fontWeight:600, color:'var(--text-3)',
                  textTransform:'uppercase', letterSpacing:'.05em',
                  marginBottom:8 }}>
      {label}
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────

const centreStyle = {
  display:'flex', alignItems:'center', justifyContent:'center',
  height:'100%', fontSize:13, color:'var(--text-3)',
}
const alertStyle = {
  padding:'8px 12px', borderRadius:'var(--radius)',
  border:'0.5px solid', fontSize:12, lineHeight:1.5,
}
const btnStyle = {
  fontSize:12, padding:'6px 12px', borderRadius:'var(--radius)',
  border:'0.5px solid var(--border-med)', background:'var(--surface)',
  color:'var(--text)', cursor:'pointer', fontFamily:'inherit',
}
const iconBtn = {
  fontSize:12, padding:'3px 7px', borderRadius:'var(--radius)',
  border:'0.5px solid var(--border)', background:'var(--surface)',
  color:'var(--text-2)', cursor:'pointer', fontFamily:'inherit',
}
const inlineInput = {
  fontSize:13, padding:'4px 7px', border:'0.5px solid var(--border-med)',
  borderRadius:'var(--radius)', background:'var(--bg)',
  color:'var(--text)', fontFamily:'inherit',
}
