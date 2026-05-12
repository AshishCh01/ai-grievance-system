import React from 'react'
import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ children, role }) {
  const token = localStorage.getItem('token')
  const currentRole = localStorage.getItem('role')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (role && currentRole !== role) {
    if (currentRole === 'user') return <Navigate to="/user" replace />
    if (currentRole === 'officer') return <Navigate to="/officer" replace />
    if (currentRole === 'admin') return <Navigate to="/admin" replace />
    return <Navigate to="/login" replace />
  }

  return children
}
