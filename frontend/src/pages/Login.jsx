import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'

const ROLES = [
  { key: 'user', label: 'Citizen' },
  { key: 'officer', label: 'Officer' },
  { key: 'admin', label: 'Admin' },
]

export default function Login() {
  const [role, setRole] = useState('user')
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
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
      <div className="glass auth-card">
        <div className="hero-copy">
          <span className="eyebrow">Smart grievance platform</span>
          <h1>AI Citizen Grievance System</h1>
          <p>
            Login as a citizen, officer, or admin. Department-wise routing, AI classification,
            Twilio updates, and mobile-friendly dashboards are built in.
          </p>
        </div>

        <div className="role-tabs" role="tablist" aria-label="Login role selection">
          {ROLES.map((item) => (
            <button
              key={item.key}
              type="button"
              className={role === item.key ? 'tab active' : 'tab'}
              onClick={() => setRole(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form className="form" onSubmit={submit}>
          <label>
            <span>{roleLabel} Email</span>
            <input
              type="email"
              placeholder={`Enter ${roleLabel.toLowerCase()} email`}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              placeholder="Enter password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </label>

          {error ? <div className="alert error">{error}</div> : null}

          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : `Login as ${roleLabel}`}
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
      </div>
    </div>
  )
}
