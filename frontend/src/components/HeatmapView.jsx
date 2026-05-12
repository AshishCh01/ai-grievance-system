import { useEffect } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'
import 'leaflet/dist/leaflet.css'

function HeatLayer({ points }) {
  const map = useMap()

  useEffect(() => {
    if (!points.length) return

    const heatPoints = points.map((p) => [
      Number(p.latitude),
      Number(p.longitude),
      1
    ])

    const heat = L.heatLayer(heatPoints, {
      radius: 25,
      blur: 18,
      maxZoom: 17,
    }).addTo(map)

    return () => {
      map.removeLayer(heat)
    }
  }, [points, map])

  return null
}

export default function HeatmapView({ grievances }) {
  const validPoints = grievances.filter(
    (g) => g.latitude && g.longitude
  )

  return (
    <MapContainer
      center={[22.9734, 78.6569]}
      zoom={5}
      minZoom={5}
      maxBounds={[
        [6.0, 68.0],
        [38.0, 98.0]
      ]}
      maxBoundsViscosity={1.0}
      style={{
        height: '500px',
        width: '100%',
        borderRadius: '20px'
      }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <HeatLayer points={validPoints} />
    </MapContainer>
  )
}