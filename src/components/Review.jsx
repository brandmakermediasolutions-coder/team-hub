import { useMemo, useState } from 'react'
import { Check, Undo2, X, Eye } from 'lucide-react'
import { useStore, useCurrentUser } from '../store/useStore'
import { reviewerFor } from '../lib/repeat'
import { Avatar, ClientTag, Due } from './ui'

/*
  Review step: a task moved to "In review" waits for its reviewer.
    <ReviewActions task />  Approve (→ Done) and Send back (→ Doing, optional one-line note)
    <ToReviewCard />        My Day card listing the tasks waiting for me
*/

export const reviewerOf = (task, employees) => task.reviewerId ?? reviewerFor(task, employees)

export function ReviewActions({ task }) {
  const updateTask = useStore((s) => s.updateTask)
  const sendBack = useStore((s) => s.sendBack)
  const showToast = useStore((s) => s.showToast)
  const assignee = useStore((s) => s.employees.find((e) => e.id === task.assigneeId))
  const [note, setNote] = useState(null) // null = note box closed
  const who = assignee?.name.split(' ')[0] ?? 'them'

  if (note === null) {
    return (
      <div className="review-actions" onClick={(e) => e.stopPropagation()}>
        <button className="btn btn-sm btn-approve" onClick={() => { updateTask(task.id, { status: 'done' }); showToast('Approved and marked done') }}><Check />Approve</button>
        <button className="btn btn-sm btn-ghost" onClick={() => setNote('')}><Undo2 />Send back</button>
      </div>
    )
  }
  const submit = (e) => {
    e.preventDefault()
    sendBack(task.id, note)
    showToast(`Sent back to ${who}`)
    setNote(null)
  }
  return (
    <form className="review-actions" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
      <input className="input input-sm grow" autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder={`What should ${who} change? (optional)`} aria-label="Note for the person" />
      <button className="btn btn-sm" type="submit"><Undo2 />Send back</button>
      <button className="icon-btn" type="button" aria-label="Cancel" onClick={() => setNote(null)}><X /></button>
    </form>
  )
}

export function ToReviewCard() {
  const user = useCurrentUser()
  const tasks = useStore((s) => s.tasks)
  const employees = useStore((s) => s.employees)
  const openTask = useStore((s) => s.openTask)
  const list = useMemo(() => tasks
    .filter((t) => t.status === 'review' && reviewerOf(t, employees) === user.id)
    .sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0)), [tasks, employees, user.id])
  if (!list.length) return null
  const name = (id) => employees.find((e) => e.id === id)?.name ?? 'Someone'
  return (
    <div className="card">
      <div className="card-head"><h2 className="row"><Eye size={16} />To review</h2><span className="badge tone-violet">{list.length}</span></div>
      <div style={{ padding: '6px 10px 10px' }}>
        {list.map((t) => (
          <div key={t.id} className="review-item">
            <button className="feed-item" onClick={() => openTask(t.id)}>
              <Avatar id={t.assigneeId} size={28} />
              <div className="grow">
                <div className="strong truncate">{t.title}</div>
                <div className="task-meta"><span>{name(t.assigneeId)}</span>{t.clientId && <><span className="sep" /><ClientTag clientId={t.clientId} /></>}</div>
              </div>
              <Due date={t.due} />
            </button>
            <ReviewActions task={t} />
          </div>
        ))}
      </div>
    </div>
  )
}
