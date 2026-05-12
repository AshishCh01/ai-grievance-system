
import React, { useEffect, useMemo, useState } from 'react'
import HeatmapView from '../components/HeatmapView'
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

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [officers, setOfficers] = useState([])
  const [officerForm, setOfficerForm] = useState({ name: '', email: '', department: '', phone: '', password: '' })
  const [message, setMessage] = useState('')

  const [grievances, setGrievances] = useState([])

  const navigate = useNavigate()

  const loadData = async () => {
    //const [dash, list] = await Promise.all([api.get('/dashboard/admin'), api.get('/admin/officers')])
    // setStats(dash.data)
    // setOfficers(list.data.items || [])

    const [dash, list, grievanceResponse] = await Promise.all([
    api.get('/dashboard/admin'),
    api.get('/admin/officers'),
    api.get('/debug/grievances')
    ])
    setStats(dash.data)
    setOfficers(list.data.items || [])
    setGrievances(grievanceResponse.data.items || [])
  }

  useEffect(() => {
    loadData().catch(() => navigate('/login'))
  }, [])

  const logout = () => {
    localStorage.clear()
    navigate('/login')
  }

  const createOfficer = async (e) => {
    e.preventDefault()
    setMessage('')
    try {
      const { data } = await api.post('/admin/officers', officerForm)
      setMessage(`Officer created. Password: ${data.password}`)
      setOfficerForm({ name: '', email: '', department: '', phone: '', password: '' })
      await loadData()
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'Failed to create officer')
    }
  }

  const departmentChart = useMemo(() => stats?.departments?.slice(0, 8) || [], [stats])

  return (
    <div className="dashboard-shell">
      <header className="topbar glass">
        <div>
          <span className="eyebrow">Admin dashboard</span>
          <h2>System control room</h2>
          <p>Manage officers, department coverage, and platform performance.</p>
        </div>
        <button className="primary-btn" onClick={logout}>Logout</button>
      </header>

      {stats ? (
        <section className="stat-grid">
          <article className="stat-card"><span>Citizens</span><strong>{stats.total_users}</strong></article>
          <article className="stat-card"><span>Officers</span><strong>{stats.total_officers}</strong></article>
          <article className="stat-card"><span>Grievances</span><strong>{stats.total_grievances}</strong></article>
          <article className="stat-card"><span>Resolved</span><strong>{stats.resolved}</strong></article>
        </section>
      ) : null}

      <section className="dashboard-grid officer-grid">
        <article className="glass panel chart-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Department load</span>
              <h3>Top grievance departments</h3>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={departmentChart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="code" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="grievances" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="glass panel chart-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Completion</span>
              <h3>Resolved vs total</h3>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Resolved', value: stats?.resolved || 0 },
                    { name: 'Pending', value: Math.max((stats?.total_grievances || 0) - (stats?.resolved || 0), 0) },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={90}
                  paddingAngle={4}
                >
                  {['#22c55e', '#f59e0b'].map((fill, index) => (
                    <Cell key={index} fill={fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="glass panel heatmap-panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Geo analytics</span>
            <h3>Grievance Heatmap</h3>
          </div>
        </div>

        <HeatmapView grievances={grievances} />
        <div className="heatmap-legend">
          <div className="heatmap-legend-item">
            <span className="legend-dot legend-low"></span>
            Low Density
          </div>

          <div className="heatmap-legend-item">
            <span className="legend-dot legend-medium"></span>
            Medium Density
          </div>

          <div className="heatmap-legend-item">
            <span className="legend-dot legend-high"></span>
            High Density
          </div>

          <div className="heatmap-legend-item">
            <span className="legend-dot legend-critical"></span>
            Critical Hotspot
          </div>
        </div>
      </section>


      <section className="dashboard-grid officer-grid admin-bottom">
        <article className="glass panel">
          <span className="eyebrow">Add officer</span>
          <h3>Create department login</h3>
          <form className="form" onSubmit={createOfficer}>
            <label><span>Name</span><input value={officerForm.name} onChange={(e) => setOfficerForm({ ...officerForm, name: e.target.value })} required /></label>
            <label><span>Email</span><input type="email" value={officerForm.email} onChange={(e) => setOfficerForm({ ...officerForm, email: e.target.value })} required /></label>
            <label><span>Department</span><input value={officerForm.department} onChange={(e) => setOfficerForm({ ...officerForm, department: e.target.value })} required /></label>
            <label><span>Phone</span><input value={officerForm.phone} onChange={(e) => setOfficerForm({ ...officerForm, phone: e.target.value })} /></label>
            <label><span>Password</span><input value={officerForm.password} onChange={(e) => setOfficerForm({ ...officerForm, password: e.target.value })} placeholder="Optional" /></label>
            {message ? <div className={message.includes('created') ? 'alert success' : 'alert error'}>{message}</div> : null}
            <button className="primary-btn" type="submit">Create officer</button>
          </form>
        </article>

        <article className="glass panel">
          <span className="eyebrow">Seeded access</span>
          <h3>Officer directory</h3>
          <div className="card-list compact-grid">
            {officers.map((o) => (
              <div className="mini-card" key={o.id}>
                <strong>{o.department || 'General'}</strong>
                <p>{o.name}</p>
                <p>{o.email}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}
