import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, ArrowUp, ArrowDown, Download, Gauge, CircleCheck, TriangleAlert, PenLine, Users, RotateCcw } from 'lucide-react'
import { useStore } from '../store/useStore'
import { DEPARTMENTS } from '../store/seed'
import { isCloud, fetchUpdatesBetween, fetchSendBacksBetween } from '../lib/backend'
import { addDays, iso, monthDays, monthLabel, shiftMonth, shortDate, todayIso } from '../lib/date'
import { isAway } from '../lib/repeat'
import { downloadFile, toCsv } from '../lib/files'
import { Avatar, AwayTag, Empty, PageMotion, TaskRow } from '../components/ui'

/*
  Monthly scorecard (admin only). One row per active person (the admin is left out, as on the Team page).
    Done        tasks marked done in the month (by completedAt), counted for whoever has the task now
    On time     done on or before the due date; tasks with no due date are counted in Done but not in On-time %
    Overdue now open tasks past their due date today (not tied to the month)
    Sent back   times a reviewer sent their task back in the month (from the activity log)
    Updates     days with at least one daily update / working days so far (Mon–Sat, from the day they were
                added to Team Hub, minus their leave; today only counts once they have sent it).
                People with no clients are not expected to send updates.
*/

const RANK = { admin: 0, head: 1, member: 2 }
const SENT_BACK = /^sent ".*" back(?::|$)/s
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null)
const monthOf = (isoDate) => `${isoDate.slice(0, 7)}-01`
const NO_REMOTE = { key: null, updates: null, activity: [], error: null }
const isWorkday = (d) => new Date(`${d}T12:00:00`).getDay() !== 0

const COLUMNS = [
  { key: 'name', label: 'Person' },
  { key: 'done', label: 'Done' },
  { key: 'onTime', label: 'On time' },
  { key: 'late', label: 'Late' },
  { key: 'onTimePct', label: 'On-time %' },
  { key: 'overdue', label: 'Overdue now' },
  { key: 'sentBack', label: 'Sent back' },
  { key: 'updPct', label: 'Daily updates' },
]

function Bar({ value, tone }) {
  if (value === null) return null
  return <span className="load-bar sc-bar"><span style={{ width: `${value}%`, background: `var(--${tone})` }} /></span>
}
const toneFor = (p) => (p === null ? 'grey' : p >= 85 ? 'green' : p >= 60 ? 'amber' : 'red')

export default function Scorecard() {
  const employees = useStore((s) => s.employees)
  const clients = useStore((s) => s.clients)
  const tasks = useStore((s) => s.tasks)
  const storeUpdates = useStore((s) => s.updates)
  const activity = useStore((s) => s.activity)
  const today = todayIso()
  const thisMonth = monthOf(today)
  const [month, setMonth] = useState(thisMonth)
  const [sort, setSort] = useState({ key: null, dir: 1 }) // null = heads first, then by name (as on the Team page)
  const [open, setOpen] = useState(null)
  const [remoteRaw, setRemote] = useState(NO_REMOTE)
  const [tryNo, setTryNo] = useState(0)

  const [y, m] = month.split('-').map(Number)
  const startTs = new Date(y, m - 1, 1).getTime()
  const endTs = new Date(y, m, 1).getTime()
  const days = useMemo(() => monthDays(month).filter((d) => d <= today), [month, today])
  const firstDay = `${month.slice(0, 7)}-01`
  const lastDay = monthDays(month).at(-1)
  // the app loads only the last 90 days of updates; older months are fetched when needed
  const needOldUpdates = isCloud && firstDay < addDays(-90)

  // earliest month worth showing: when the first person or task was added
  const firstMonth = useMemo(() => {
    const ts = [...employees, ...tasks].reduce((min, x) => (x.createdAt && x.createdAt < min ? x.createdAt : min), Infinity)
    return Number.isFinite(ts) ? monthOf(iso(new Date(ts))) : thisMonth
  }, [employees, tasks, thisMonth])

  // cloud: the store keeps only the latest 500 activity entries, so read this month's "sent back" entries in full
  const fetchKey = `${month}#${tryNo}`
  useEffect(() => {
    if (!isCloud) return
    let live = true
    Promise.all([
      needOldUpdates ? fetchUpdatesBetween(firstDay, lastDay) : Promise.resolve(null),
      fetchSendBacksBetween(startTs, endTs),
    ]).then(([updates, acts]) => { if (live) setRemote({ key: fetchKey, updates, activity: acts, error: null }) })
      .catch((e) => { console.error(e); if (live) setRemote({ key: fetchKey, updates: null, activity: [], error: 'Could not load this month from the database. Check your internet and try again.' }) })
    return () => { live = false }
  }, [fetchKey, needOldUpdates, firstDay, lastDay, startTs, endTs])

  // results of an earlier month (or an earlier try) are never shown for this one
  const remote = remoteRaw.key === fetchKey ? remoteRaw : NO_REMOTE
  const loading = isCloud && remoteRaw.key !== fetchKey
  const updatesReady = !needOldUpdates || (!loading && remote.updates !== null)

  const updates = useMemo(() => {
    if (!needOldUpdates) return storeUpdates
    const byId = new Map((remote.updates ?? []).map((u) => [u.id, u]))
    storeUpdates.forEach((u) => byId.set(u.id, u))
    return [...byId.values()]
  }, [needOldUpdates, storeUpdates, remote.updates])

  const sendBacks = useMemo(() => {
    const byId = new Map()
    ;[...(isCloud ? remote.activity : []), ...activity].forEach((a) => {
      if (a.type === 'status' && a.at >= startTs && a.at < endTs && SENT_BACK.test(a.text ?? '')) byId.set(a.id, a)
    })
    return [...byId.values()]
  }, [activity, remote.activity, startTs, endTs])

  const rows = useMemo(() => employees.filter((e) => e.active && e.role !== 'admin').map((e) => {
    const joined = e.createdAt ? iso(new Date(e.createdAt)) : null
    const myClients = clients.filter((c) => c.active && c.memberIds?.includes(e.id))
    const sentDates = new Set(updates.filter((u) => u.employeeId === e.id && u.date >= firstDay && u.date <= lastDay).map((u) => u.date))
    const expected = myClients.length
      ? days.filter((d) => isWorkday(d) && (!joined || d >= joined) && !isAway(e, d) && (d < today || sentDates.has(d)))
      : []
    const sent = expected.filter((d) => sentDates.has(d)).length
    const mine = tasks.filter((t) => t.assigneeId === e.id)
    const done = mine.filter((t) => t.status === 'done' && t.completedAt >= startTs && t.completedAt < endTs)
    const lateList = done.filter((t) => t.due && iso(new Date(t.completedAt)) > t.due).sort((a, b) => a.completedAt - b.completedAt)
    const onTime = done.filter((t) => t.due).length - lateList.length
    const overdueList = mine.filter((t) => t.status !== 'done' && t.due && t.due < today).sort((a, b) => a.due.localeCompare(b.due))
    const backs = sendBacks.filter((a) => a.targetId === e.id).sort((a, b) => a.at - b.at)
    return {
      e, myClients, lateList, overdueList, backs,
      missed: expected.filter((d) => !sentDates.has(d)),
      name: e.name.toLowerCase(),
      done: done.length, onTime, late: lateList.length, noDue: done.length - onTime - lateList.length,
      onTimePct: pct(onTime, onTime + lateList.length),
      overdue: overdueList.length, sentBack: backs.length,
      needsUpdates: myClients.length > 0, sent, expected: expected.length,
      updPct: myClients.length ? pct(sent, expected.length) : null,
    }
  }), [employees, clients, updates, tasks, sendBacks, days, today, firstDay, lastDay, startTs, endTs])

  // grouped by department; the chosen column sorts people inside each department
  const groups = useMemo(() => {
    const cmp = (a, b) => {
      const av = sort.key ? a[sort.key] : 0, bv = sort.key ? b[sort.key] : 0
      if (av === bv) return RANK[a.e.role] - RANK[b.e.role] || a.name.localeCompare(b.name)
      if (av === null) return 1
      if (bv === null) return -1
      return (av < bv ? -1 : 1) * sort.dir
    }
    const deps = [...new Set(rows.map((r) => r.e.department))].sort((a, b) => (DEPARTMENTS.indexOf(a) + 1 || 99) - (DEPARTMENTS.indexOf(b) + 1 || 99) || a.localeCompare(b))
    return deps.map((d) => ({ dep: d, rows: rows.filter((r) => r.e.department === d).sort(cmp) }))
  }, [rows, sort])

  const totals = useMemo(() => {
    const sum = (k, list = rows) => list.reduce((n, r) => n + r[k], 0)
    const req = rows.filter((r) => r.needsUpdates)
    const onTime = sum('onTime'), late = sum('late')
    return { done: sum('done'), onTime, late, onTimePct: pct(onTime, onTime + late), overdue: sum('overdue'), sent: sum('sent', req), expected: sum('expected', req), updPct: pct(sum('sent', req), sum('expected', req)) }
  }, [rows])

  const sortBy = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: key === 'name' ? 1 : -1 }))

  const exportCsv = useCallback(() => {
    const head = ['Department', 'Person', 'Designation', 'Tasks done', 'On time', 'Late', 'No due date', 'On-time %', 'Overdue now', 'Sent back from review', 'Update days sent', 'Working days expected', 'Update %']
    const body = groups.flatMap((g) => g.rows.map((r) => [
      r.e.department, r.e.name, r.e.title, r.done, r.onTime, r.late, r.noDue, r.onTimePct ?? '', r.overdue, r.sentBack,
      r.needsUpdates ? r.sent : '', r.needsUpdates ? r.expected : 'Not required', r.updPct ?? '',
    ]))
    const total = ['', 'Team total', '', totals.done, totals.onTime, totals.late, rows.reduce((n, r) => n + r.noDue, 0), totals.onTimePct ?? '', totals.overdue, rows.reduce((n, r) => n + r.sentBack, 0), totals.sent, totals.expected, totals.updPct ?? '']
    const note = [`Scorecard for ${monthLabel(month)}, made ${today}. Working days = Monday to Saturday up to today, minus leave. Overdue = right now.`]
    downloadFile(`team-scorecard-${month.slice(0, 7)}.csv`, toCsv([head, ...body, [], total, [], note]), 'text/csv;charset=utf-8')
  }, [groups, totals, rows, month, today])

  const isThisMonth = month === thisMonth
  const updCell = (r) => {
    if (!r.needsUpdates) return <span className="muted small" title="No clients assigned, so no daily update is expected">Not needed</span>
    if (!updatesReady) return <span className="muted small">…</span>
    if (!r.expected) return <span className="muted small">No working days</span>
    return <div className="sc-pct"><span><b>{r.sent}</b><span className="muted">/{r.expected}</span></span><Bar value={r.updPct} tone={toneFor(r.updPct)} /></div>
  }

  return (
    <PageMotion>
      <div className="page-head">
        <div><h1>Scorecard</h1><p className="page-sub">How each person did this month: work done on time, what is late, and daily updates.</p></div>
        <div className="row row-wrap" style={{ gap: 8 }}>
          <div className="row month-nav">
            <button className="icon-btn" aria-label="Previous month" disabled={month <= firstMonth} onClick={() => { setMonth(shiftMonth(month, -1)); setOpen(null) }}><ChevronLeft /></button>
            <b style={{ minWidth: 140, textAlign: 'center' }}>{monthLabel(month)}</b>
            <button className="icon-btn" aria-label="Next month" disabled={isThisMonth} onClick={() => { setMonth(shiftMonth(month, 1)); setOpen(null) }}><ChevronRight /></button>
          </div>
          <button className="btn btn-sm" onClick={exportCsv} disabled={!rows.length || !updatesReady}><Download />Download as Excel</button>
        </div>
      </div>

      <div className="grid grid-4">
        <div className="card stat"><div className="stat-label"><Gauge />On time</div><div className="stat-value">{totals.onTimePct ?? '—'}{totals.onTimePct !== null && <span className="stat-of">%</span>}</div><div className="stat-foot">{totals.onTime} of {totals.onTime + totals.late} with a due date</div></div>
        <div className="card stat"><div className="stat-label"><CircleCheck />Tasks done</div><div className="stat-value">{totals.done}</div><div className="stat-foot">{isThisMonth ? 'this month so far' : monthLabel(month)}</div></div>
        <div className={`card stat ${totals.overdue ? 'is-alert' : ''}`}><div className="stat-label"><TriangleAlert />Overdue now</div><div className="stat-value">{totals.overdue}</div><div className="stat-foot">open and past due today</div></div>
        <div className="card stat"><div className="stat-label"><PenLine />Daily updates</div><div className="stat-value">{updatesReady ? totals.updPct ?? '—' : '…'}{updatesReady && totals.updPct !== null && <span className="stat-of">%</span>}</div><div className="stat-foot">{updatesReady ? `${totals.sent} of ${totals.expected} working days` : 'loading…'}</div></div>
      </div>

      {remote.error && (
        <div className="note-line is-warn"><TriangleAlert size={14} /><span className="grow">{remote.error}</span>
          <button className="btn btn-sm" onClick={() => setTryNo((n) => n + 1)}><RotateCcw />Try again</button>
        </div>
      )}

      {rows.length === 0 ? <div className="card"><Empty icon={Users} title="No one on the team yet" /></div> : (
        <div className="card table-wrap">
          <table className="table sc-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                    <button className={`sc-sort ${sort.key === c.key ? 'on' : ''}`} onClick={() => sortBy(c.key)}>
                      {c.label}{sort.key === c.key && (sort.dir === 1 ? <ArrowUp /> : <ArrowDown />)}
                    </button>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.dep}>
                  <tr className="sc-group"><td colSpan={COLUMNS.length + 1}><span className="sc-sticky">{g.dep}</span></td></tr>
                  {g.rows.map((r) => (
                    <Fragment key={r.e.id}>
                      <tr className="click-row" onClick={() => setOpen(open === r.e.id ? null : r.e.id)}>
                        <td><div className="row" style={{ gap: 10 }}><Avatar id={r.e.id} size={28} /><div><div className="row" style={{ gap: 6 }}><b>{r.e.name}</b><AwayTag id={r.e.id} /></div><div className="tiny muted">{r.e.title}</div></div></div></td>
                        <td>{r.done}</td>
                        <td>{r.onTime}</td>
                        <td>{r.late ? <b style={{ color: 'var(--amber)' }}>{r.late}</b> : 0}</td>
                        <td>{r.onTimePct === null ? <span className="muted">—</span> : <div className="sc-pct"><b>{r.onTimePct}%</b><Bar value={r.onTimePct} tone={toneFor(r.onTimePct)} /></div>}</td>
                        <td>{r.overdue ? <b style={{ color: 'var(--red)' }}>{r.overdue}</b> : 0}</td>
                        <td>{r.sentBack || 0}</td>
                        <td>{updCell(r)}</td>
                        <td style={{ textAlign: 'right' }}><ChevronDown size={16} className={`chev ${open === r.e.id ? 'up' : ''}`} /></td>
                      </tr>
                      {open === r.e.id && (
                        <tr className="expand-row"><td colSpan={COLUMNS.length + 1}><div className="sc-sticky sc-expand">
                          <div className="grid grid-2">
                            <div>
                              <div className="section-title" style={{ marginBottom: 6 }}>Done late · {monthLabel(month)}</div>
                              {r.lateList.length === 0 ? <div className="muted small">Nothing done late.</div> : r.lateList.map((t) => <TaskRow key={t.id} task={t} />)}
                              {r.noDue > 0 && <div className="tiny muted mt-8">{r.noDue} done task{r.noDue > 1 ? 's' : ''} had no due date (not in on-time %).</div>}
                            </div>
                            <div>
                              <div className="section-title" style={{ marginBottom: 6 }}>Overdue now</div>
                              {r.overdueList.length === 0 ? <div className="muted small">Nothing overdue.</div> : r.overdueList.map((t) => <TaskRow key={t.id} task={t} />)}
                            </div>
                          </div>
                          {(r.backs.length > 0 || (r.needsUpdates && updatesReady && r.missed.length > 0)) && (
                            <div className="stack mt-16" style={{ gap: 4 }}>
                              {r.backs.length > 0 && <div className="tiny muted">Sent back: {r.backs.map((a) => `${(a.text.match(/^sent "(.*)" back/s)?.[1] ?? 'a task')} (${shortDate(iso(new Date(a.at)))})`).join(' · ')}</div>}
                              {r.needsUpdates && updatesReady && r.missed.length > 0 && <div className="tiny muted">No update on: {r.missed.map(shortDate).join(', ')}</div>}
                            </div>
                          )}
                        </div></td></tr>
                      )}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="tiny muted">
        Working days are Monday to Saturday up to today, from the day the person was added, minus their leave dates (today counts once the update is in).
        People with no clients are not expected to send updates. Tasks with no due date count as done but not in the on-time %.
        {loading && ' Loading this month from the database…'}
      </p>
    </PageMotion>
  )
}
