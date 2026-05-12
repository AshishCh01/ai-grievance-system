import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import api from '../api'

const emptyForm = { title: '', description: '', location: '' }

export default function UserDashboard() {
  const [stats, setStats] = useState(null)
  const [grievances, setGrievances] = useState([])
  const [notifications, setNotifications] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [duplicateData, setDuplicateData] = useState(null)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const loadData = async () => {
    const [dash, list, note] = await Promise.all([
      api.get('/dashboard/user'),
      api.get('/grievances/my'),
      api.get('/notifications/my'),
    ])
    setStats(dash.data)
    setGrievances(list.data.items || [])
    setNotifications(note.data.items || [])
  }

  useEffect(() => {
    loadData().catch(() => navigate('/login'))
  }, [])

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!form.title && !form.description) {
        setPreview(null)
        return
      }
      try {
        const { data } = await api.post('/ai/preview', form)
        setPreview(data.preview)
      } catch {
        setPreview(null)
      }
    }, 650)

    return () => clearTimeout(timer)
  }, [form.title, form.description, form.location])


//
const fetchLocations = async (query) => {
  if (!query) {
    setSuggestions([])
    return
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=in&limit=5`,
      {
        headers: {
          'User-Agent': 'AI-Grievance-System'
        }
      }
    )

    const data = await response.json()
    setSuggestions(data)
  } catch (error) {
    console.error('Location search error:', error)
  }
}
//




  const submitGrievance = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const formData = new FormData()
      formData.append('title', form.title)
      formData.append('description', form.description)
      formData.append('location', form.location)

      if (selectedLocation) {
        formData.append('latitude', selectedLocation.latitude)
        formData.append('longitude', selectedLocation.longitude)
      }

      if (file) formData.append('file', file)
      const { data } = await api.post('/grievances', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      if (data.duplicate_detected) {
        setDuplicateData(data)
        setShowDuplicateModal(true)
        return
      }

      setMessage(`${data.grievance.grievance_code} submitted successfully`)
      setForm(emptyForm)
      setFile(null)
      setSelectedLocation(null)
      setSuggestions([])
    
      await loadData()
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'Submission failed')
    } finally {
      setLoading(false)
    }
  }

  // Submit duplicate
  const submitAnyway = async () => {
    try {
      setLoading(true)

      const formData = new FormData()

      formData.append('title', form.title)
      formData.append('description', form.description)
      formData.append('location', form.location)

      if (selectedLocation) {
        formData.append('latitude', selectedLocation.latitude)
        formData.append('longitude', selectedLocation.longitude)
      }

      formData.append('force_submit', true)

      if (file) {
        formData.append('file', file)
      }

      const { data } = await api.post('/grievances', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setMessage(`${data.grievance.grievance_code} submitted successfully`)

      setShowDuplicateModal(false)
      setDuplicateData(null)

      setForm(emptyForm)
      setFile(null)
      setSelectedLocation(null)
      setSuggestions([])

      await loadData()
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'Submission failed')
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.clear()
    navigate('/login')
  }

  const chartData = useMemo(() => stats?.by_status || [], [stats])

  return (
    <div className="dashboard-shell">
      <header className="topbar glass">
        <div>
          <span className="eyebrow">Citizen dashboard</span>
          <h2>{stats?.user?.name || 'Citizen'} — grievance tracking center</h2>
          <p>Submit complaints, see AI routing, and track every update.</p>
        </div>
        <div className="topbar-actions">
          <Link className="ghost-btn" to="/login">Switch account</Link>
          <button className="primary-btn" onClick={logout}>Logout</button>
        </div>
      </header>

      {stats ? (
        <section className="stat-grid">
          <article className="stat-card">
            <span>Total</span>
            <strong>{stats.total}</strong>
          </article>
          <article className="stat-card">
            <span>Open</span>
            <strong>{stats.open}</strong>
          </article>
          <article className="stat-card">
            <span>Resolved</span>
            <strong>{stats.resolved}</strong>
          </article>
          <article className="stat-card">
            <span>Urgent</span>
            <strong>{stats.urgent}</strong>
          </article>
        </section>
      ) : null}

      <section className="dashboard-grid">
        <div className="stack">
          <article className="glass panel">
            <div className="section-head">
              <div>
                <span className="eyebrow">AI preview</span>
                <h3>Live grievance classification</h3>
              </div>
            </div>
            <div className="preview-box">
              <div className="preview-pill">Department: {preview?.department || 'Waiting for input'}</div>
              <div className="preview-pill">Priority: {preview?.priority || '—'}</div>
              <div className="preview-pill">Sentiment: {preview?.sentiment || '—'}</div>
              <div className="preview-pill">Confidence: {preview ? `${Math.round((preview.confidence || 0) * 100)}%` : '—'}</div>
            </div>
            <p className="muted">{preview?.summary || 'Type the complaint to see the AI route it to the right department.'}</p>
            <p className="muted small">{preview?.suggested_action || ''}</p>
          </article>

          <article className="glass panel">
            <span className="eyebrow">New grievance</span>
            <h3>Submit complaint</h3>
            <form className="form" onSubmit={submitGrievance}>
              <label>
                <span>Title</span>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Short title" required />
              </label>
              <label>
                <span>Description</span>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows="6" placeholder="Describe your issue clearly" required />
              </label>
              
              
              {/* <label>
                <span>Location</span>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Area, ward, village, landmark" />
              </label> */}


              <label>
                <span>Location</span>
                <input
                    value={form.location}
                    placeholder="Search area, ward, village, landmark"
                    onChange={(e) => {
                        setForm({ ...form, location: e.target.value })
                        fetchLocations(e.target.value)
                    }}
                />

                {suggestions.length > 0 && (
                    <div className="location-suggestions">
                        {suggestions.map((item) => (
                            <div
                                key={item.place_id}
                                className="location-item"
                                onClick={() => {
                                    setForm({
                                        ...form,
                                        location: item.display_name
                                    })

                                    setSelectedLocation({
                                        latitude: item.lat,
                                        longitude: item.lon
                                    })

                                    setSuggestions([])
                                }}
                            >
                                {item.display_name}
                            </div>
                        ))}
                    </div>
                )}
              </label>







              <label>
                <span>Attachment</span>
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
              {message ? <div className={message.includes('successfully') ? 'alert success' : 'alert error'}>{message}</div> : null}
              <button className="primary-btn" type="submit" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit grievance'}
              </button>
            </form>
          </article>
        </div>

        <div className="stack">
          <article className="glass panel chart-panel">
            <div className="section-head">
              <div>
                <span className="eyebrow">Status chart</span>
                <h3>My grievance distribution</h3>
              </div>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={92}
                    innerRadius={50}
                    paddingAngle={4}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#4f46e5', '#06b6d4', '#22c55e', '#f59e0b'][index % 4]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="glass panel">
            <div className="section-head">
              <div>
                <span className="eyebrow">Updates</span>
                <h3>Recent notifications</h3>
              </div>
            </div>
            <div className="list compact-list">
              {notifications.length ? notifications.slice(0, 4).map((note) => (
                <div key={note.id} className="mini-card">
                  <strong>{note.channel.toUpperCase()} · {note.status}</strong>
                  <p>{note.message}</p>
                </div>
              )) : <p className="muted">No notifications yet.</p>}
            </div>
          </article>
        </div>
      </section>

      <section className="glass panel list-panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">History</span>
            <h3>My grievances</h3>
          </div>
        </div>
        <div className="card-list">
          {grievances.map((g) => (
            <article className="complaint-card" key={g.id}>
              <div className="card-top">
                <div>
                  <strong>{g.grievance_code}</strong>
                  <h4>{g.title}</h4>
                </div>
                <span className={`status-chip status-${String(g.status).toLowerCase().replace(/\s+/g, '-')}`}>{g.status}</span>
              </div>
              <p className="muted">{g.department} · {g.priority} priority · {g.sentiment}</p>
              <p>{g.description}</p>
              <div className="tag-row">
                {g.location ? <span className="tag">📍 {g.location}</span> : null}
                {g.ai_summary ? <span className="tag">🤖 {g.ai_summary}</span> : null}
                {g.officer_remarks ? <span className="tag">📝 {g.officer_remarks}</span> : null}
                {g.duplicate_score ? <span className="tag">🔁 Duplicate risk {Math.round(g.duplicate_score * 100)}%</span> : null}
              </div>
            </article>
          ))}
          {!grievances.length ? <p className="muted">No grievances submitted yet.</p> : null}
        </div>
      </section>

      {showDuplicateModal && duplicateData && (
        <div className="duplicate-modal-overlay">
          <div className="duplicate-modal">
            <h3>Similar Grievance Found</h3>

            <p>
              A similar grievance already exists.
            </p>

            <p>
              <strong>Grievance Code:</strong> {duplicateData.grievance_code}
            </p>

            <p>
              <strong>Similarity:</strong> {duplicateData.similarity}%
            </p>

            <div className="duplicate-actions">
              <button
                className="secondary-btn"
                onClick={() => {
                  setShowDuplicateModal(false)
                  setDuplicateData(null)
                }}
              >
                Cancel
              </button>

              <button
                className="primary-btn"
                onClick={submitAnyway}
              >
                Submit Anyway
              </button>
            </div>
          </div>
        </div>
    )}
    </div>
  )
}
