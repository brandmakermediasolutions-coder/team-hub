import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, User, UserCheck, Calendar, Flag, Building2, Target, Link2, Send, Ban, Check, Plus } from 'lucide-react'
import { useStore, useCurrentUser } from '../store/useStore'
import { STATUSES, PRIORITIES } from '../store/seed'
import { canEditTask, canReassign, assignableEmployees } from '../lib/permissions'
import { relTime } from '../lib/date'
import { Avatar, BlockedNote, ClientTag, Due, PriorityBadge } from './ui'

function Person({ id }) {
  const e = useStore((s) => s.employees.find((x) => x.id === id))
  return <span className="row"><Avatar id={id} size={24} /><span className="strong">{e?.name ?? 'Unknown'}</span><span className="muted small truncate">{e?.title}</span></span>
}

function CommentText({ text }) {
  const parts = text.split(/(@\w+)/g)
  return <>{parts.map((p, i) => (p.startsWith('@') ? <span key={i} className="mention">{p}</span> : p))}</>
}

function DrawerBody({ task }) {
  const user = useCurrentUser()
  const employees = useStore((s) => s.employees)
  const projects = useStore((s) => s.projects)
  const allComments = useStore((s) => s.comments)
  const allActivity = useStore((s) => s.activity)
  const updateTask = useStore((s) => s.updateTask)
  const addComment = useStore((s) => s.addComment)

  const editable = canEditTask(user, task, employees)
  const reassignable = canReassign(user, task, employees)
  const people = useMemo(() => assignableEmployees(user, employees), [user, employees])
  const comments = useMemo(() => allComments.filter((c) => c.taskId === task.id), [allComments, task.id])
  const history = useMemo(() => allActivity.filter((a) => a.taskId === task.id && a.type !== 'comment').slice(0, 12), [allActivity, task.id])
  const project = projects.find((p) => p.id === task.projectId)
  const name = (id) => employees.find((e) => e.id === id)?.name ?? 'Someone'

  const [title, setTitle] = useState(task.title)
  const [desc, setDesc] = useState(task.description)
  const [doneWhen, setDoneWhen] = useState(task.doneWhen)
  const [blocking, setBlocking] = useState(false)
  const [blockOn, setBlockOn] = useState('')
  const [blockWhy, setBlockWhy] = useState('')
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
    updateTask(task.id, { links: [...task.links, /^https?:\/\//.test(v) ? v : `https://${v}`] })
    setLink('')
  }
  const others = employees.filter((e) => e.active && e.id !== user.id)

  return (
    <>
      <div className="drawer-body">
        <div className="stack" style={{ gap: 14 }}>
          <textarea className="title-input" rows={2} value={title} disabled={!editable} aria-label="Task title"
            onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() ? save('title', title.trim()) : setTitle(task.title)} />
          <div className="status-pills" role="group" aria-label="Status">
            {STATUSES.map((s) => (
              <button key={s.id} className={`status-pill ${task.status === s.id ? 'on' : ''}`} disabled={!editable}
                onClick={() => updateTask(task.id, { status: s.id })}>{s.label}</button>
            ))}
          </div>
          {task.blocked && <BlockedNote blocked={task.blocked} />}
        </div>

        <dl className="props">
          <dt><UserCheck />Assigned to</dt>
          <dd>{reassignable
            ? <select className="select select-sm" value={task.assigneeId} onChange={(e) => updateTask(task.id, { assigneeId: e.target.value })}>
                {!people.some((p) => p.id === task.assigneeId) && <option value={task.assigneeId}>{name(task.assigneeId)}</option>}
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            : <Person id={task.assigneeId} />}</dd>
          <dt><User />Assigned by</dt>
          <dd><Person id={task.assignedById} /></dd>
          <dt><Building2 />Client</dt>
          <dd className="row">{task.clientId ? <ClientTag clientId={task.clientId} /> : <span className="muted">Internal</span>}{project && <span className="chip truncate">{project.name}</span>}</dd>
          <dt><Calendar />Due</dt>
          <dd className="row">{editable
            ? <input className="input select-sm" type="date" style={{ width: 160 }} value={task.due ?? ''} onChange={(e) => updateTask(task.id, { due: e.target.value || null })} />
            : null}<Due date={task.due} done={task.status === 'done'} /></dd>
          <dt><Flag />Priority</dt>
          <dd>{editable
            ? <select className="select select-sm" value={task.priority} onChange={(e) => updateTask(task.id, { priority: e.target.value })}>
                {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            : <PriorityBadge priority={task.priority} />}</dd>
        </dl>

        <div className="stack" style={{ gap: 8 }}>
          <div className="section-title row"><Target size={13} />Done when</div>
          <input className="input" value={doneWhen} disabled={!editable} placeholder="What does “finished” look like?"
            onChange={(e) => setDoneWhen(e.target.value)} onBlur={() => save('doneWhen', doneWhen.trim())} />
          <div className="section-title mt-8">Details</div>
          <textarea className="textarea" value={desc} disabled={!editable} placeholder="Add a brief, references, notes…"
            onChange={(e) => setDesc(e.target.value)} onBlur={() => save('description', desc.trim())} />
        </div>

        <div className="stack" style={{ gap: 8 }}>
          <div className="section-title row"><Link2 size={13} />Files & links</div>
          {task.links.map((l, i) => (
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

        {editable && task.status !== 'done' && (
          <div className="stack" style={{ gap: 8 }}>
            {task.blocked ? (
              <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => updateTask(task.id, { blocked: null })}><Check />Unblock — I have what I need</button>
            ) : !blocking ? (
              <button className="btn btn-sm btn-danger" style={{ alignSelf: 'flex-start' }} onClick={() => setBlocking(true)}><Ban />I'm blocked on this</button>
            ) : (
              <div className="card card-pad stack" style={{ boxShadow: 'none' }}>
                <div className="strong">What are you waiting for?</div>
                <div className="form-grid">
                  <select className="select" value={blockOn} onChange={(e) => setBlockOn(e.target.value)} aria-label="Waiting on">
                    <option value="">Waiting on…</option>
                    {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input className="input" value={blockWhy} onChange={(e) => setBlockWhy(e.target.value)} placeholder="Reason (e.g. need final copy)" />
                </div>
                <div className="row">
                  <button className="btn btn-primary btn-sm" disabled={!blockOn}
                    onClick={() => { updateTask(task.id, { blocked: { onId: blockOn, reason: blockWhy.trim() } }); setBlocking(false); setBlockOn(''); setBlockWhy('') }}>Mark as blocked</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setBlocking(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="stack">
          <div className="section-title">Comments · {comments.length}</div>
          {comments.length === 0 && <div className="muted small">No comments yet. Use @Name to notify a teammate.</div>}
          <AnimatePresence initial={false}>
            {comments.map((c) => (
              <motion.div key={c.id} className="comment" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Avatar id={c.authorId} size={28} />
                <div className="grow">
                  <div className="row small"><span className="strong">{name(c.authorId)}</span><span className="muted">{relTime(c.at)}</span></div>
                  <div className="comment-bubble mt-4"><CommentText text={c.text} /></div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
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
