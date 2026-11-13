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
// "Today" / "Tomorrow" / "Overdue" next to the due date, worked out in India time
const dueHint = (d: string | null) => {
  if (!d) return null
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const days = Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
  if (days < 0) return { text: 'Overdue', color: '#d2362f' }
  if (days === 0) return { text: 'Today', color: '#b86e00' }
  if (days === 1) return { text: 'Tomorrow', color: '#b86e00' }
  return null
}

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
  const firstName = (to.name ?? '').split(' ')[0] || 'there'
  const giverFirst = giver.split(' ')[0]
  const font = "font-family:Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
  const badge = t.urgent
    ? { text: 'URGENT TASK', color: '#d2362f', bg: '#fde9e7' }
    : autoNew ? { text: 'REPEATING TASK', color: '#6d4fe0', bg: '#eeeafc' } : { text: 'NEW TASK', color: '#f04e23', bg: '#fdeee9' }
  const intro = autoNew
    ? `Hi ${esc(firstName)}, this one comes back on a schedule. It is on your list now.`
    : `Hi ${esc(firstName)}, <b style="color:#16181d">${esc(giverFirst)}</b> gave you a task in Team Hub.`
  const hint = dueHint(t.due)
  const row = (label: string, value: string, last = false) => `
          <tr>
            <td style="${font};font-size:13px;color:#8a8f99;padding:11px 16px;width:84px;${last ? '' : 'border-bottom:1px solid #ececea;'}">${label}</td>
            <td style="${font};font-size:14px;color:#16181d;font-weight:600;padding:11px 16px 11px 0;${last ? '' : 'border-bottom:1px solid #ececea;'}">${value}</td>
          </tr>`
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f3ef">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(clientName)} · ${niceDate(t.due)}${t.urgent ? ' · Urgent' : ''}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f3ef" style="background:#f3f3ef"><tr><td align="center" style="padding:32px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px">
      <tr><td style="padding:0 4px 16px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td bgcolor="#f04e23" style="background:#f04e23;border-radius:9px;width:34px;height:34px;text-align:center;${font};font-size:13px;font-weight:800;color:#ffffff">BM</td>
          <td style="padding-left:10px;${font};font-size:15px;font-weight:700;color:#16181d">Team Hub <span style="font-weight:400;color:#8a8f99">· Brandmaker333</span></td>
        </tr></table>
      </td></tr>
      <tr><td bgcolor="#ffffff" style="background:#ffffff;border:1px solid #e6e6e1;border-radius:16px;padding:28px 28px 26px">
        <span style="display:inline-block;${font};font-size:11px;font-weight:700;letter-spacing:.08em;color:${badge.color};background:${badge.bg};border-radius:99px;padding:5px 10px">${badge.text}</span>
        <h1 style="${font};font-size:22px;line-height:1.3;font-weight:700;color:#16181d;margin:14px 0 8px">${esc(t.title)}</h1>
        <p style="${font};font-size:14px;line-height:1.55;color:#4a4f5a;margin:0 0 20px">${intro}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fafaf8" style="background:#fafaf8;border:1px solid #ececea;border-radius:12px;border-collapse:separate">
          ${row('Client', esc(clientName))}
          ${row('Due', `${niceDate(t.due)}${hint ? ` <span style="font-weight:600;color:${hint.color}">· ${hint.text}</span>` : ''}`, autoNew)}
          ${autoNew ? '' : row('From', esc(giver), true)}
        </table>
        ${t.notes ? `
        <div style="${font};font-size:11px;font-weight:700;letter-spacing:.08em;color:#8a8f99;margin:20px 0 6px">NOTES</div>
        <div style="${font};font-size:14px;line-height:1.55;color:#16181d;border-left:3px solid #f04e23;padding:2px 0 2px 12px;white-space:pre-wrap">${esc(t.notes)}</div>` : ''}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px"><tr>
          <td bgcolor="#f04e23" style="background:#f04e23;border-radius:10px">
            <a href="${link}" style="display:inline-block;${font};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;padding:12px 22px">Open the task &rarr;</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:16px 6px 0;${font};font-size:12px;line-height:1.6;color:#8a8f99">
        ${autoNew ? 'This task repeats on a schedule set in Team Hub (Admin &rarr; Repeating).' : 'You got this email because a task was given to you in Team Hub.'}<br>
        Brandmaker333 · internal tool
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`

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
