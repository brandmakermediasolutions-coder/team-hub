import { useState } from 'react'
import { CircleCheck, Mail, ListChecks, CalendarDays, Users, Loader2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { DEPARTMENTS, EMAIL_DOMAIN } from '../store/seed'
import { isCloud } from '../lib/backend'
import { Avatar } from '../components/ui'

export function Splash() {
  return <div className="splash"><div className="brand-mark">BM</div><Loader2 className="spin" /></div>
}

function Art() {
  return (
    <div className="login-art">
      <div className="row" style={{ gap: 10 }}><div className="brand-mark">BM</div><b>Brandmaker333 · Team Hub</b></div>
      <div>
        <h1>Your day's work, in one place.</h1>
        <p>See what's yours, write one line per client, and get on with it.</p>
        <div className="login-points">
          <div><ListChecks />Your tasks, sorted by what's due first</div>
          <div><Mail />An email the moment someone gives you a task</div>
          <div><CalendarDays />The post calendar for every client</div>
          <div><Users />Heads see the whole team at a glance</div>
        </div>
      </div>
      <div className="small" style={{ color: '#8d919c' }}>Internal tool · Brandmaker333</div>
    </div>
  )
}

function DemoPicker() {
  const employees = useStore((s) => s.employees)
  const demoLogin = useStore((s) => s.demoLogin)
  const resetDemo = useStore((s) => s.resetDemo)
  return (
    <div className="login-box" style={{ width: 'min(520px, 100%)' }}>
      <div>
        <h2 style={{ fontSize: 22 }}>Who are you?</h2>
        <p className="muted mt-4">Demo mode: pick a person to look around. Nothing is shared until the database is connected.</p>
      </div>
      <div className="demo-list">
        {DEPARTMENTS.map((dep) => {
          const people = employees.filter((e) => e.active && e.department === dep)
          if (!people.length) return null
          return (
            <div key={dep}>
              <div className="section-title" style={{ margin: '6px 2px' }}>{dep}</div>
              <div className="demo-grid">
                {people.map((e) => (
                  <button key={e.id} className="demo-acc" onClick={() => demoLogin(e.id)}>
                    <Avatar id={e.id} size={30} />
                    <div className="grow"><div className="strong">{e.name}</div><div className="tiny muted truncate">{e.title}</div></div>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'center' }} onClick={() => window.confirm('Reset the demo data?') && resetDemo()}>Reset demo data</button>
    </div>
  )
}

function CloudLogin() {
  const phase = useStore((s) => s.phase)
  const authEmail = useStore((s) => s.authEmail)
  const { signIn, signUp, sendReset, setNewPassword, logout, reload } = useStore.getState()
  const [mode, setMode] = useState('signin') // signin | first | forgot
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null) // { tone, text }

  const fullEmail = (v) => (v.includes('@') ? v.trim() : `${v.trim().toLowerCase()}@${EMAIL_DOMAIN}`)
  const run = async (fn) => { setBusy(true); setMsg(null); try { await fn() } finally { setBusy(false) } }

  if (phase === 'not-on-team' || phase === 'error') {
    return (
      <div className="login-box">
        <h2 style={{ fontSize: 22 }}>{phase === 'error' ? 'Could not load Team Hub' : 'Not on the team list'}</h2>
        <p className="muted">{phase === 'error'
          ? 'The database did not answer. Check your internet connection and try again.'
          : `${authEmail} is signed in but is not an active member. Ask Bidhan to add or reactivate this email in Admin → People.`}</p>
        <div className="row">
          {phase === 'error' && <button className="btn btn-primary" onClick={reload}>Try again</button>}
          <button className="btn" onClick={logout}>Sign out</button>
        </div>
      </div>
    )
  }

  if (phase === 'recovery') {
    const submit = (e) => {
      e.preventDefault()
      if (pw.length < 8) return setMsg({ tone: 'error', text: 'Use at least 8 characters.' })
      if (pw !== pw2) return setMsg({ tone: 'error', text: 'The two passwords do not match.' })
      run(async () => { const r = await setNewPassword(pw); if (!r.ok) setMsg({ tone: 'error', text: r.error }) })
    }
    return (
      <form className="login-box" onSubmit={submit}>
        <h2 style={{ fontSize: 22 }}>Set a new password</h2>
        <input className="input" type="password" placeholder="New password (8+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        <input className="input" type="password" placeholder="Type it again" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        {msg && <div className={msg.tone === 'error' ? 'error-text' : 'ok-text'}>{msg.text}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>Save password</button>
      </form>
    )
  }

  const submit = (e) => {
    e.preventDefault()
    const em = fullEmail(email)
    if (!email.trim()) return setMsg({ tone: 'error', text: 'Enter your work email.' })
    if (mode === 'forgot') {
      return run(async () => {
        const r = await sendReset(em)
        setMsg(r.ok ? { tone: 'ok', text: `We sent a reset link to ${em}.` } : { tone: 'error', text: r.error })
      })
    }
    if (pw.length < (mode === 'first' ? 8 : 1)) return setMsg({ tone: 'error', text: mode === 'first' ? 'Use at least 8 characters.' : 'Enter your password.' })
    if (mode === 'first' && pw !== pw2) return setMsg({ tone: 'error', text: 'The two passwords do not match.' })
    run(async () => {
      if (mode === 'signin') {
        const r = await signIn(em, pw)
        if (!r.ok) setMsg({ tone: 'error', text: r.error })
      } else {
        const r = await signUp(em, pw)
        if (!r.ok) setMsg({ tone: 'error', text: r.error })
        else if (r.needsConfirm) setMsg({ tone: 'ok', text: `Almost done. Open the email we sent to ${em} and click the link to confirm.` })
      }
    })
  }

  const title = { signin: 'Sign in', first: 'First time here', forgot: 'Reset password' }[mode]
  return (
    <form className="login-box" onSubmit={submit}>
      <div>
        <h2 style={{ fontSize: 22 }}>{title}</h2>
        <p className="muted mt-4">{mode === 'first' ? 'Create your password. Use your work email.' : mode === 'forgot' ? 'We will email you a link to set a new password.' : 'Use your work email.'}</p>
      </div>
      <div className="email-field">
        <input className="input" type="text" inputMode="email" autoComplete="username" placeholder="yourname" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        {!email.includes('@') && <span className="email-suffix">@{EMAIL_DOMAIN}</span>}
      </div>
      {mode !== 'forgot' && <input className="input" type="password" autoComplete={mode === 'first' ? 'new-password' : 'current-password'} placeholder={mode === 'first' ? 'New password (8+ characters)' : 'Password'} value={pw} onChange={(e) => setPw(e.target.value)} />}
      {mode === 'first' && <input className="input" type="password" autoComplete="new-password" placeholder="Type it again" value={pw2} onChange={(e) => setPw2(e.target.value)} />}
      {msg && <div className={msg.tone === 'error' ? 'error-text' : 'ok-text'}>{msg.tone === 'ok' && <CircleCheck size={14} />} {msg.text}</div>}
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? <Loader2 className="spin" /> : { signin: 'Sign in', first: 'Create password', forgot: 'Send reset link' }[mode]}</button>
      <div className="row between small">
        {mode === 'signin'
          ? <><button type="button" className="link" onClick={() => { setMode('first'); setMsg(null) }}>First time? Create password</button>
              <button type="button" className="link" onClick={() => { setMode('forgot'); setMsg(null) }}>Forgot password?</button></>
          : <button type="button" className="link" onClick={() => { setMode('signin'); setMsg(null) }}>← Back to sign in</button>}
      </div>
    </form>
  )
}

export default function Login() {
  return (
    <div className="login">
      <Art />
      <div className="login-form">{isCloud ? <CloudLogin /> : <DemoPicker />}</div>
    </div>
  )
}
