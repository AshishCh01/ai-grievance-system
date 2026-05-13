import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, PhoneCall, ShieldCheck, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import api from '../api'

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/auth/register', form)
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      localStorage.setItem('role', data.user.role)
      navigate('/user')
    } catch (err) {
      setError(err?.response?.data?.detail || 'Registration failed')
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
            <span className="eyebrow">Citizen onboarding</span>
            <h1>Register for grievance updates</h1>
            <p className="muted">
              Create a citizen profile to file grievances, upload evidence, and receive
              resolution updates.
            </p>
          </div>
          <ul className="feature-list">
            <li className="feature-item">
              <UserRound size={18} />
              <div>
                <strong>Single citizen profile</strong>
                <p className="auth-mini">Track every grievance in one place.</p>
              </div>
            </li>
            <li className="feature-item">
              <ShieldCheck size={18} />
              <div>
                <strong>Protected data</strong>
                <p className="auth-mini">Secure access with role-based routing.</p>
              </div>
            </li>
            <li className="feature-item">
              <PhoneCall size={18} />
              <div>
                <strong>SMS status alerts</strong>
                <p className="auth-mini">Get officer updates on your phone.</p>
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
          <span className="eyebrow">Citizen onboarding</span>
          <h1>Create account</h1>
          <p className="muted">Register as a citizen to submit and track grievances.</p>

          <form className="form tw-gap-4" onSubmit={submit}>
            <label>
              <span>Full Name</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoComplete="name"
                required
              />
            </label>
            <label>
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="email"
                required
              />
            </label>
            <label>
              <span>Phone Number</span>
              <input
                type="tel"
                placeholder="Optional but recommended for SMS updates"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                autoComplete="tel"
              />
            </label>
            
            <label>
              <span>Password</span>
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
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
              {loading ? 'Creating...' : 'Create Account'}
              <ArrowRight size={18} />
            </button>
          </form>

          <p className="muted action-link">
            Already registered? <Link to="/login">Login here</Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
