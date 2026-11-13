// Team Hub · email the person who was just given a task.
//
// Triggered by a Supabase Database Webhook on the `tasks` table (INSERT and UPDATE).
// Sends through Resend (resend.com). Secrets to set in Supabase → Edge Functions → Secrets:
//   RESEND_API_KEY   your Resend API key
//   MAIL_FROM        e.g. "Team Hub <teamhub@brandmaker333.com>" (domain verified in Resend)
//   APP_URL          the Team Hub web address, e.g. https://team-hub.vercel.app
//   WEBHOOK_SECRET   any long random text; the webhook sends it in the x-webhook-secret header
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from 'npm:@supabase/supabase-js@2'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const niceDate = (d: string | null) =>
  d ? new Date(`${d}T12:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : 'No due date'

Deno.serve(async (req) => {
  const secret = Deno.env.get('WEBHOOK_SECRET')
  if (secret && req.headers.get('x-webhook-secret') !== secret) return new Response('forbidden', { status: 403 })

  const { type, record: t, old_record: old } = await req.json()
  if (!t || (type !== 'INSERT' && type !== 'UPDATE')) return new Response('ignored')

  // only when someone is newly given the task, and not when you add a task for yourself
  const newlyAssigned = type === 'INSERT' || old?.assignee_id !== t.assignee_id
  if (!newlyAssigned || !t.assignee_id || t.status === 'done') return new Response('no change')

  const ids = [t.assignee_id, t.assigned_by_id].filter(Boolean)
  const { data: people } = await db.from('employees').select('id, name, email, active').in('id', ids)
  const to = people?.find((p) => p.id === t.assignee_id)
  const from = people?.find((p) => p.id === t.assigned_by_id)
  // repeating tasks are made automatically by Team Hub (nobody "gave" them), so they always get an email
  const repeating = Boolean(t.repeat_rule_id)
  // UPDATE: whoever reassigned it is not stored on the task, so skip only clear self-assignments
  if (!to?.email || !to.active || (type === 'INSERT' && !repeating && t.assignee_id === t.assigned_by_id)) return new Response('no email needed')

  let clientName = 'Internal'
  if (t.client_id) {
    const { data: c } = await db.from('clients').select('name').eq('id', t.client_id).single()
    if (c) clientName = c.name
  }

  const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '')
  const link = `${appUrl}/?task=${encodeURIComponent(t.id)}`
  const giver = from?.name ?? 'A teammate'
  const autoNew = repeating && type === 'INSERT'
  const subject = autoNew
    ? `New repeating task: ${t.title}`
    : `${t.urgent ? '🔥 Urgent: ' : ''}${giver.split(' ')[0]} gave you a task: ${t.title}`
  const html = `
  <div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#16181d">
    <div style="font-size:13px;color:#8a8f99;margin-bottom:6px">Team Hub · Brandmaker333</div>
    <h2 style="margin:0 0 16px;font-size:20px">${esc(t.title)}</h2>
    <table style="font-size:14px;border-collapse:collapse;margin-bottom:18px">
      <tr><td style="color:#8a8f99;padding:4px 16px 4px 0">From</td><td>${autoNew ? `Team Hub (repeating task, on behalf of ${esc(giver)})` : esc(giver)}</td></tr>
      <tr><td style="color:#8a8f99;padding:4px 16px 4px 0">Client</td><td>${esc(clientName)}</td></tr>
      <tr><td style="color:#8a8f99;padding:4px 16px 4px 0">Due</td><td>${niceDate(t.due)}</td></tr>
      ${t.urgent ? '<tr><td style="color:#8a8f99;padding:4px 16px 4px 0">Priority</td><td style="color:#d2362f;font-weight:600">Urgent</td></tr>' : ''}
    </table>
    ${t.notes ? `<div style="background:#f5f5f2;border-radius:10px;padding:12px 14px;font-size:14px;margin-bottom:18px;white-space:pre-wrap">${esc(t.notes)}</div>` : ''}
    <a href="${link}" style="display:inline-block;background:#f04e23;color:#fff;text-decoration:none;font-weight:600;padding:11px 18px;border-radius:10px">Open the task</a>
    <div style="font-size:12px;color:#8a8f99;margin-top:22px">${autoNew ? 'This task comes back on a schedule (Admin → Repeating in Team Hub).' : 'You got this because a task was given to you in Team Hub.'}</div>
  </div>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: Deno.env.get('MAIL_FROM'), to: [to.email], subject, html }),
  })
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text())
    return new Response('email failed', { status: 502 })
  }
  return new Response('sent')
})
