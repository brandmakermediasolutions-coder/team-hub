import { useState } from 'react'
import { motion } from 'framer-motion'
import { CircleCheck, ArrowRight } from 'lucide-react'
import { useStore } from '../store/useStore'
import { ROLE_LABEL } from '../lib/permissions'
import { Avatar, Field } from '../components/ui'

const DEMO = ['BM-001', 'BM-003', 'BM-005']

export default function Login() {
  const login = useStore((s) => s.login)
  const employees = useStore((s) => s.employees)
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const res = login(id, pw)
    if (!res.ok) setError(res.error)
  }

  return (
    <div className="login">
      <div className="login-art">
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark">BM</div>
          <div><div className="brand-name">Team Hub</div><div className="brand-sub" style={{ color: '#8d919c' }}>Brandmaker333</div></div>
        </div>
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}>
          <h1>Who is doing what, for which client, by when.</h1>
          <p>One place for every task, hand-off and update across the agency — so nothing gets lost in chat.</p>
          <div className="login-points">
            <div><CircleCheck />See every task assigned to you, and who assigned it</div>
            <div><CircleCheck />Team heads assign clients and balance workload</div>
            <div><CircleCheck />Every change is logged automatically</div>
          </div>
        </motion.div>
        <div className="small" style={{ color: '#6f7480' }}>First draft · demo data stored in this browser only</div>
      </div>

      <div className="login-form">
        <motion.form className="login-box" onSubmit={submit} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}>
          <div>
            <h1>Sign in</h1>
            <p className="page-sub">Use your employee ID and password.</p>
          </div>
          <Field label="Employee ID">
            <input className="input" value={id} onChange={(e) => { setId(e.target.value); setError('') }} placeholder="BM-001" autoFocus autoComplete="username" />
          </Field>
          <Field label="Password">
            <input className="input" type="password" value={pw} onChange={(e) => { setPw(e.target.value); setError('') }} placeholder="••••••••" autoComplete="current-password" />
          </Field>
          {error && <motion.div className="error-text" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}>{error}</motion.div>}
          <button className="btn btn-primary btn-block" style={{ height: 42 }} type="submit">Sign in<ArrowRight /></button>

          <div className="row" style={{ gap: 12 }}><hr className="divider grow" /><span className="muted tiny">OR TRY A DEMO ACCOUNT</span><hr className="divider grow" /></div>
          <div className="demo-grid">
            {DEMO.map((d) => {
              const e = employees.find((x) => x.id === d)
              if (!e) return null
              return (
                <button type="button" key={d} className="demo-acc" onClick={() => { const r = login(e.id, e.password); if (!r.ok) setError(r.error) }}>
                  <Avatar id={e.id} size={34} />
                  <div className="grow">
                    <div className="strong">{e.name} <span className="muted small mono">· {e.id}</span></div>
                    <div className="muted small truncate">{e.title}</div>
                  </div>
                  <span className={`badge ${e.role === 'admin' ? 'tone-accent' : e.role === 'head' ? 'tone-violet' : 'tone-grey'}`}>{ROLE_LABEL[e.role]}</span>
                </button>
              )
            })}
          </div>
        </motion.form>
      </div>
    </div>
  )
}
