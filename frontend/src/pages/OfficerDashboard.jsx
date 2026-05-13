import React, { useEffect, useMemo, useState } from 'react'
import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import api from '../api'

const STATUS_OPTIONS = ['All', 'Submitted', 'Assigned', 'In Review', 'Action Taken', 'Resolved', 'Rejected']

export default function OfficerDashboard() {
  const [stats, setStats] = useState(null)
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [remarks, setRemarks] = useState({})
  const [busyId, setBusyId] = useState(null)
  const navigate = useNavigate()

  const loadData = async () => {
    const [dash, list] = await Promise.all([
      api.get('/dashboard/officer'),
      api.get('/officer/grievances'),
    ])
    setStats(dash.data)
    setItems(list.data.items || [])
  }

  useEffect(() => {
    loadData().catch(() => navigate('/login'))
  }, [])

  const updateStatus = async (id, status) => {
    setBusyId(id)
    try {
      await api.patch(`/officer/grievances/${id}`, {
        status,
        officer_remarks: remarks[id] || '',
      })
      await loadData()
    } finally {
      setBusyId(null)
    }
  }

  const logout = () => {
    localStorage.clear()
    navigate('/login')
  }

  const filtered = useMemo(() => {
    return items.filter((g) => {
      const statusMatch = filter === 'All' || g.status === filter
      const searchText = `${g.title} ${g.description} ${g.creator_name} ${g.grievance_code} ${g.department}`.toLowerCase()
      const searchMatch = !search || searchText.includes(search.toLowerCase())
      return statusMatch && searchMatch
    })
  }, [items, filter, search])

  return (
    <div className="dashboard-shell">
      <header className="topbar glass">
        <div>
          <span className="eyebrow">Officer dashboard</span>
          <h2>{stats?.officer?.department || 'Department'} — workbench</h2>
          <p>Track assigned grievances, update status, and resolve citizen complaints quickly.</p>
        </div>
        <div className="topbar-actions">
          <button className="primary-btn with-icon" onClick={logout}>
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </header>

      {stats ? (
        <section className="stat-grid">
          <article className="stat-card"><span>Total</span><strong>{stats.total}</strong></article>
          <article className="stat-card"><span>Pending</span><strong>{stats.pending}</strong></article>
          <article className="stat-card"><span>Resolved</span><strong>{stats.resolved}</strong></article>
          <article className="stat-card"><span>Critical</span><strong>{stats.urgent}</strong></article>
        </section>
      ) : null}

      <section className="dashboard-grid officer-grid">
        <article className="glass panel chart-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Workload charts</span>
              <h3>Status distribution</h3>
            </div>
          </div>
          <div className="chart-wrap chart-shell">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats?.by_status || []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="glass panel chart-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Priority mix</span>
              <h3>Complaint severity</h3>
            </div>
          </div>
          <div className="chart-wrap chart-shell">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={stats?.by_priority || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={48} paddingAngle={4}>
                  {(stats?.by_priority || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#10b981', '#06b6d4', '#f59e0b', '#ef4444'][index % 4]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="glass panel list-panel">
        <div className="section-head section-head-column">
          <div>
            <span className="eyebrow">Complaint queue</span>
            <h3>Assigned grievances</h3>
          </div>
          <div className="filter-row tw-gap-3 tw-w-full">
            <input
              className="search-input tw-flex-1"
              placeholder="Search grievance, citizen, code, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="tw-min-w-[180px]" value={filter} onChange={(e) => setFilter(e.target.value)}>
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
        </div>

        <div className="card-list tw-gap-4">
          {filtered.map((g) => (
            <article className="complaint-card officer-card" key={g.id}>
              <div className="card-top">
                <div>
                  <strong>{g.grievance_code}</strong>
                  <h4>{g.title}</h4>
                </div>
                <span className={`status-chip status-${String(g.status).toLowerCase().replace(/\s+/g, '-')}`}>{g.status}</span>
              </div>
              <p className="muted">Citizen: {g.creator_name} · {g.creator_email}{g.citizen_phone ? ` · ${g.citizen_phone}` : ''}</p>
              <p className="muted">{g.department} · {g.priority} · {g.sentiment}{g.confidence ? ` · AI ${Math.round(g.confidence * 100)}%` : ''}</p>
              <p>{g.description}</p>
              
              {g.attachment_url ? (
                <div className="complaint-image-wrap">
                    <img
                        src={g.attachment_url}
                        alt="Grievance Attachment"
                        className="complaint-image"
                    />

                    <a
                        href={g.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="image-link"
                    >
                    View Full Image
                    </a>
                </div>
              ) : null}

              <div className="tag-row">
                {g.location ? <span className="tag">📍 {g.location}</span> : null}
                {g.ai_summary ? <span className="tag">🤖 {g.ai_summary}</span> : null}
                {g.suggested_action ? <span className="tag">🧭 {g.suggested_action}</span> : null}
                {g.duplicate_score ? <span className="tag">🔁 Similarity {Math.round(g.duplicate_score * 100)}%</span> : null}
              </div>

              <label className="remarks-block">
                <span>Officer remarks</span>
                <textarea
                  rows="3"
                  placeholder="Add resolution note, field update, or citizen instruction"
                  value={remarks[g.id] || g.officer_remarks || ''}
                  onChange={(e) => setRemarks({ ...remarks, [g.id]: e.target.value })}
                />
              </label>

              <div className="button-row">
                <button className="status-btn" data-variant="assigned" disabled={busyId === g.id} onClick={() => updateStatus(g.id, 'Assigned')}>Assign</button>
                <button className="status-btn" data-variant="review" disabled={busyId === g.id} onClick={() => updateStatus(g.id, 'In Review')}>Review</button>
                <button className="status-btn" data-variant="action" disabled={busyId === g.id} onClick={() => updateStatus(g.id, 'Action Taken')}>Action Taken</button>
                <button className="status-btn" data-variant="resolved" disabled={busyId === g.id} onClick={() => updateStatus(g.id, 'Resolved')}>Resolve</button>
                <button className="status-btn" data-variant="rejected" disabled={busyId === g.id} onClick={() => updateStatus(g.id, 'Rejected')}>Reject</button>
              </div>
            </article>
          ))}
          {!filtered.length ? <p className="muted">No grievances found for the selected filters.</p> : null}
        </div>
      </section>
    </div>
  )
}
