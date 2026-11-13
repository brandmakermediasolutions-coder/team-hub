import { useState } from 'react'
import { DatabaseBackup, Download, TriangleAlert, CircleCheck } from 'lucide-react'
import { useStore } from '../store/useStore'
import { isCloud, fetchBackup, toDb, TABLES } from '../lib/backend'
import { iso, todayIso } from '../lib/date'
import { downloadFile, toXlsx } from '../lib/files'

/*
  Backup (admin only): one Excel workbook with a sheet per table, or an exact JSON copy.
  Cloud mode reads every table in full, fresh from the database (not just what the app has loaded).
  Demo mode uses what is in this browser. "Last backup" is remembered in this browser only.
*/

const LAST_KEY = 'team-hub-last-backup'
const WEEK = 7 * 86400000
const SHEETS = [
  ['employees', 'People'], ['clients', 'Clients'], ['tasks', 'Tasks'], ['comments', 'Comments'],
  ['updates', 'Daily updates'], ['posts', 'Post calendar'], ['repeat_rules', 'Repeating rules'],
  ['task_templates', 'Templates'], ['activity', 'Activity'], ['repeat_runs', 'Repeating runs'],
]
const STORE_KEY = { repeat_rules: 'rules', task_templates: 'templates', repeat_runs: 'repeatRuns' }
const LABEL = Object.fromEntries(SHEETS)

export function lastBackupAt() {
  try { return Number(localStorage.getItem(LAST_KEY)) || null } catch { return null }
}
export const backupDue = () => { const t = lastBackupAt(); return !t || Date.now() - t > WEEK }

const when = (ts) => new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const z = (n) => String(n).padStart(2, '0')
const stamp = (ts) => { const d = new Date(ts); return `${iso(d)} ${z(d.getHours())}:${z(d.getMinutes())}` }

// one value -> one spreadsheet cell (the JSON copy keeps everything exactly as stored)
function cell(key, v) {
  if (v === null || v === undefined) return ''
  if (Array.isArray(v)) return v.every((x) => x === null || typeof x !== 'object') ? v.join(', ') : JSON.stringify(v)
  if (typeof v === 'object') return JSON.stringify(v)
  if (typeof v === 'number' && /(^|_)at$/.test(key) && v > 1e11) return stamp(v)
  return v
}

function sheetRows(rows) {
  const seen = []
  rows.forEach((r) => Object.keys(r).forEach((k) => { if (!seen.includes(k)) seen.push(k) }))
  const cols = seen.includes('id') ? ['id', ...seen.filter((k) => k !== 'id')] : seen
  return [cols, ...rows.map((r) => cols.map((k) => cell(k, r[k])))]
}

function fromStore() {
  const s = useStore.getState()
  return Object.fromEntries(TABLES.map((t) => [t, (s[STORE_KEY[t] ?? t] ?? []).map(toDb)]))
}

export default function BackupCard({ onDone }) {
  const showToast = useStore((s) => s.showToast)
  const [last, setLast] = useState(lastBackupAt)
  const [job, setJob] = useState(null) // { kind, step, total, table } while working
  const [error, setError] = useState(null)
  const [notes, setNotes] = useState([])

  const run = async (kind) => {
    setError(null)
    setJob({ kind, step: 0, total: TABLES.length, table: null })
    try {
      const { tables, notes: n } = isCloud
        ? await fetchBackup((step, total, table) => setJob({ kind, step, total, table }))
        : { tables: fromStore(), notes: [] }
      const now = Date.now()
      const day = todayIso()
      const counts = SHEETS.map(([t, label]) => [label, (tables[t] ?? []).length])
      if (kind === 'json') {
        const copy = { app: 'Team Hub', source: isCloud ? 'shared database' : 'demo (this browser)', exportedAt: new Date(now).toISOString(), notes: n, tables }
        downloadFile(`team-hub-backup-${day}.json`, JSON.stringify(copy, null, 1), 'application/json')
      } else {
        const about = [
          ['Team Hub backup'], [],
          ['Made on', stamp(now)],
          ['Source', isCloud ? 'Shared database (complete tables)' : 'Demo mode (this browser)'],
          [], ['Sheet', 'Rows'], ...counts,
          ...(n.length ? [[], ['Notes'], ...n.map((x) => [x])] : []),
          [], ['Times are shown in this computer\'s time zone. The JSON copy has the exact stored values.'],
        ]
        const sheets = [{ name: 'About', rows: about }, ...SHEETS.map(([t]) => ({ name: LABEL[t], rows: sheetRows(tables[t] ?? []) }))]
        downloadFile(`team-hub-backup-${day}.xlsx`, toXlsx(sheets))
      }
      try { localStorage.setItem(LAST_KEY, String(now)) } catch { /* private window: just don't remember */ }
      setLast(now)
      setNotes(n)
      onDone?.()
      showToast(`Backup downloaded · ${counts.reduce((x, [, c]) => x + c, 0)} rows`)
    } catch (e) {
      console.error(e)
      setError(`Backup failed${e?.message ? `: ${e.message}` : ''}. Nothing was downloaded. Check your internet and try again.`)
    } finally {
      setJob(null)
    }
  }

  const due = !last || Date.now() - last > WEEK
  const progress = job ? Math.round(((job.step + (job.table ? 0.5 : 0)) / job.total) * 100) : 0

  return (
    <div className="card card-pad stack">
      <h2 className="row"><DatabaseBackup size={16} />Backup</h2>
      <p className="small soft">
        One Excel file with a sheet for each list: people, clients, tasks, comments, daily updates, post calendar, repeating tasks, templates and activity.
        {isCloud ? ' Everything is read fresh from the shared database, including old history.' : ' Demo mode: this backs up what is saved in this browser.'}
      </p>
      <div className="row row-wrap" style={{ gap: 10 }}>
        <button className="btn btn-primary btn-sm" disabled={!!job} onClick={() => run('xlsx')}><Download />{job?.kind === 'xlsx' ? 'Preparing…' : 'Download backup'}</button>
        <button className="btn btn-ghost btn-sm" disabled={!!job} onClick={() => run('json')}>{job?.kind === 'json' ? 'Preparing…' : 'Download full copy (JSON)'}</button>
      </div>
      {job && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="load-bar backup-progress"><span style={{ width: `${progress}%` }} /></span>
          <span className="tiny muted">{job.table ? `Reading ${LABEL[job.table]?.toLowerCase() ?? job.table} (${job.step + 1} of ${job.total})…` : 'Starting…'}</span>
        </div>
      )}
      {error && <div className="note-line is-warn"><TriangleAlert size={14} /><span>{error}</span></div>}
      {!job && !error && notes.length > 0 && <div className="tiny muted">Note: {notes.join('; ')}.</div>}
      {due && !job
        ? <div className="note-line is-warn"><TriangleAlert size={14} /><span>{last ? `Last backup: ${when(last)}. It has been more than a week, time for a fresh one.` : 'No backup downloaded from this browser yet.'}</span></div>
        : last && !job && <div className="row ok-text"><CircleCheck size={16} />Last backup: {when(last)}</div>}
    </div>
  )
}
