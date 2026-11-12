import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, User, UserCheck, Calendar, Building2, Link2, Send, Plus, Flame, Trash2 } from 'lucide-react'
import { useStore, useCurrentUser } from '../store/useStore'
import { STATUSES } from '../store/seed'
import { canEditTask, canDeleteTask } from '../lib/permissions'
import { relTime } from '../lib/date'
import { Avatar, ClientTag, Due } from './ui'
import { PeopleOptions } from './NewTaskModal'

function Person({ id }) {
  const e = useStore((s) => s.employees.find((x) => x.id === id))
  return <span className="row"><Avatar id={id} size={24} /><span className="strong">{e?.name ?? 'Unknown'}</span><span className="muted small truncate">{e?.title}</span></span>
}

function CommentText({ text }) {
  return <>{text.split(/(@\w+)/g).map((p, i) => (p.startsWith('@') ? <span key={i} className="mention">{p}</span> : p))}</>
}

function DrawerBody({ task }) {
  const user = useCurrentUser()
  const employees = useStore((s) => s.employees)
  const clients = useStore((s) => s.clients)
  const allComments = useStore((s) => s.comments)
  const allActivity = useStore((s) => s.activity)
  const updateTask = useStore((s) => s.updateTask)
  const deleteTask = useStore((s) => s.deleteTask)
  const addComment = useStore((s) => s.addComment)
  const showToast = useStore((s) => s.showToast)

  const editable = canEditTask(user, task, employees)
  const comments = useMemo(() => allComments.filter((c) => c.taskId === task.id).sort((a, b) => a.at - b.at), [allComments, task.id])
  const history = useMemo(() => allActivity.filter((a) => a.taskId === task.id && a.type !== 'comment').sort((a, b) => b.at - a.at).slice(0, 10), [allActivity, task.id])
  const name = (id) => employees.find((e) => e.id === id)?.name ?? 'Someone'

  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes ?? '')
  const [link, setLink] = useState('')
  const [draft, setDraft] = useState('')
  const endRef = useRef(null)

  const save = (key, value) => value !== task[key] && updateTask(task.id, { [key]: value })
  const send = () => {
    if (!draft.trim()) return
    addComment(task.id, draft)
    setDraft('')
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 60)
  }
  const addLink = () => {
    const v = link.trim()
    if (!v) return
    updateTask(task.id, { links: [...(task.links ?? []), /^https?:\/\//.test(v) ? v : `https://${v}`] })
    setLink('')
  }
  const reassign = (id) => {
    updateTask(task.id, { assigneeId: id })
    if (id !== user.id) showToast(`Given to ${name(id)}. They'll be notified.`)
  }

  return (
    <>
      <div className="drawer-body">
        <div className="stack" style={{ gap: 14 }}>
          <textarea className="title-input" rows={2} value={title} disabled={!editable} aria-label="Task title"
            onChange={(e) => setTitle(e.target.value)} onBlur={() => (title.trim() ? save('title', title.trim()) : setTitle(task.title))} />
          <div className="status-pills" role="group" aria-label="Status">
            {STATUSES.map((s) => (
              <button key={s.id} className={`status-pill s-${s.id} ${task.status === s.id ? 'on' : ''}`} disabled={!editable}
                onClick={() => updateTask(task.id, { status: s.id })}>{s.label}</button>
            ))}
          </div>
        </div>

        <dl className="props">
          <dt><UserCheck />Who does it</dt>
          <dd>{editable
            ? <select className="select select-sm" value={task.assigneeId} onChange={(e) => reassign(e.target.value)}><PeopleOptions employees={employees} meId={user.id} /></select>
            : <Person id={task.assigneeId} />}</dd>
          <dt><User />Given by</dt>
          <dd><Person id={task.assignedById} /></dd>
          <dt><Building2 />Client</dt>
          <dd>{editable
            ? <select className="select select-sm" value={task.clientId ?? ''} onChange={(e) => updateTask(task.id, { clientId: e.target.value || null })}>
                <option value="">Internal / no client</option>
                {clients.filter((c) => c.active || c.id === task.clientId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            : task.clientId ? <ClientTag clientId={task.clientId} /> : <span className="muted">Internal</span>}</dd>
          <dt><Calendar />Due</dt>
          <dd className="row">{editable && <input className="input select-sm" type="date" style={{ width: 160 }} value={task.due ?? ''} onChange={(e) => updateTask(task.id, { due: e.target.value || null })} />}<Due date={task.due} done={task.status === 'done'} /></dd>
          <dt><Flame />Urgent</dt>
          <dd><label className={`check ${task.urgent ? 'on urgent' : ''}`}><input type="checkbox" disabled={!editable} checked={!!task.urgent} onChange={(e) => updateTask(task.id, { urgent: e.target.checked })} />{task.urgent ? 'Yes' : 'No'}</label></dd>
        </dl>

        <div className="stack" style={{ gap: 8 }}>
          <div className="section-title">Notes</div>
          <textarea className="textarea" value={notes} disabled={!editable} placeholder="Brief, references, what “done” looks like…"
            onChange={(e) => setNotes(e.target.value)} onBlur={() => save('notes', notes.trim())} />
        </div>

        <div className="stack" style={{ gap: 8 }}>
          <div className="section-title row"><Link2 size={13} />Files & links</div>
          {(task.links ?? []).map((l, i) => (
            <div className="row between" key={i}>
              <a className="chip truncate" href={l} target="_blank" rel="noreferrer" style={{ maxWidth: '100%' }}><Link2 size={13} />{l.replace(/^https?:\/\//, '')}</a>
              {editable && <button className="icon-btn" aria-label="Remove link" onClick={() => updateTask(task.id, { links: task.links.filter((_, j) => j !== i) })}><X /></button>}
            </div>
          ))}
          {editable && (
            <div className="row">
              <input className="input" value={link} placeholder="Paste a Drive, Canva or Figma link" onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLink()} />
              <button className="btn" onClick={addLink}><Plus />Add</button>
            </div>
          )}
        </div>

        <div className="stack">
          <div className="section-title">Comments · {comments.length}</div>
          {comments.length === 0 && <div className="muted small">No comments yet. Type @Name to notify someone.</div>}
          {comments.map((c) => (
            <div key={c.id} className="comment">
              <Avatar id={c.authorId} size={28} />
              <div className="grow">
                <div className="row small"><span className="strong">{name(c.authorId)}</span><span className="muted">{relTime(c.at)}</span></div>
                <div className="comment-bubble mt-4"><CommentText text={c.text} /></div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {history.length > 0 && (
          <div className="stack" style={{ gap: 10 }}>
            <div className="section-title">History</div>
            <div className="timeline">
              {history.map((a) => (
                <div key={a.id} className="timeline-item"><div><b style={{ color: 'var(--ink)', fontWeight: 600 }}>{name(a.actorId)}</b> {a.text.replace(` "${task.title}"`, ' this task')} <span className="muted">· {relTime(a.at)}</span></div></div>
              ))}
            </div>
          </div>
        )}

        {canDeleteTask(user, task) && (
          <button className="btn btn-ghost btn-sm btn-danger" style={{ alignSelf: 'flex-start' }}
            onClick={() => window.confirm('Delete this task? This cannot be undone.') && deleteTask(task.id)}><Trash2 />Delete task</button>
        )}
      </div>

      <div className="drawer-foot">
        <div className="composer">
          <Avatar id={user.id} size={30} />
          <textarea className="textarea" rows={1} value={draft} placeholder="Write a comment…  @Name to mention" aria-label="Write a comment"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
          <button className="btn btn-primary" onClick={send} disabled={!draft.trim()} aria-label="Send comment"><Send /></button>
        </div>
      </div>
    </>
  )
}

export default function TaskDrawer() {
  const openTaskId = useStore((s) => s.openTaskId)
  const task = useStore((s) => s.tasks.find((t) => t.id === s.openTaskId) ?? null)
  const close = useStore((s) => s.closeTask)

  useEffect(() => {
    if (!openTaskId) return
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openTaskId, close])

  return (
    <AnimatePresence>
      {task && (
        <>
          <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <motion.aside className="drawer" role="dialog" aria-modal="true" aria-label="Task details"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 38 }}>
            <div className="drawer-head">
              <span className="badge mono">{task.id}</span>
              <span className="muted small grow">Created {relTime(task.createdAt)}</span>
              <button className="icon-btn" onClick={close} aria-label="Close"><X /></button>
            </div>
            <DrawerBody key={task.id} task={task} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
