import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import { ArrowRight, Building2, ShieldCheck, UserRound, WandSparkles, Eye, EyeOff } from 'lucide-react'


const ROLES = [
  { key: 'user', label: 'Citizen', icon: UserRound },
  { key: 'officer', label: 'Officer', icon: Building2 },
  { key: 'admin', label: 'Admin', icon: ShieldCheck },
]

export default function Login() {
  const [role, setRole] = useState('user')
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [showPassword, setShowPassword] = useState(false)

  const navigate = useNavigate()

  const roleLabel = useMemo(() => ROLES.find((r) => r.key === role)?.label || 'Citizen', [role])

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/auth/login', { ...form, role })
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      localStorage.setItem('role', data.user.role)
      navigate(data.user.role === 'officer' ? '/officer' : data.user.role === 'admin' ? '/admin' : '/user')
    } catch (err) {
      setError(err?.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="screen auth-screen">
      <div className="auth-frame">
        <motion.div
          className="auth-side"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="brand-seal">CGS</div>
          <div>
            <span className="eyebrow">Government grievance desk</span>
            <h1>AI Citizen Grievance System</h1>
            <p className="muted">
              One portal for citizens, officers, and admins. Route complaints with AI, track
              every action, and keep citizens updated in real time.
            </p>
          </div>
          <ul className="feature-list">
            <li className="feature-item">
              <ShieldCheck size={18} />
              <div>
                <strong>Verified routing</strong>
                <p className="auth-mini">Auto-assigns department and priority.</p>
              </div>
            </li>
            <li className="feature-item">
              <WandSparkles size={18} />
              <div>
                <strong>AI preview</strong>
                <p className="auth-mini">Preview classification before submission.</p>
              </div>
            </li>
            <li className="feature-item">
              <Building2 size={18} />
              <div>
                <strong>Officer workbench</strong>
                <p className="auth-mini">Track SLAs, resolve, and notify citizens.</p>
              </div>
            </li>
          </ul>
        </motion.div>

        <motion.div
          className="glass auth-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
        >
          <div className="hero-copy tw-space-y-3">
            <span className="eyebrow">Secure access</span>
            <h1>Sign in</h1>
            <p>
              Choose your role and continue to the grievance command center.
            </p>
          </div>

          <div className="role-tabs tw-gap-3" role="tablist" aria-label="Login role selection">
            {ROLES.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  type="button"
                  className={role === item.key ? 'tab active' : 'tab'}
                  onClick={() => setRole(item.key)}
                  aria-pressed={role === item.key}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              )
            })}
          </div>

          <form className="form tw-gap-4" onSubmit={submit}>
            <label>
              <span>{roleLabel} Email</span>
              <input
                type="email"
                placeholder={`Enter ${roleLabel.toLowerCase()} email`}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="email"
                required
              />
            </label>

            <label>
              <span>Password</span>
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {error ? <div className="alert error">{error}</div> : null}

            <button className="primary-btn tw-w-full with-icon" type="submit" disabled={loading}>
              {loading ? 'Signing in...' : `Login as ${roleLabel}`}
              <ArrowRight size={18} />
            </button>
          </form>

          {role === 'user' ? (
            <p className="muted action-link">
              New citizen? <Link to="/register">Create an account</Link>
            </p>
          ) : (
            <p className="muted action-link">
              Use the seeded department account for this role.
            </p>
          )}
        </motion.div>
      </div>
    </div>
  )
}
