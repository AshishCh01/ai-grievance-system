import { useEffect } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'
import 'leaflet/dist/leaflet.css'

function HeatLayer({ points }) {
  const map = useMap()

  useEffect(() => {
    if (!points.length) return

    const heat = L.heatLayer(heatPoints, {
      radius: 30,
      blur: 22,
      maxZoom: 12,
      minOpacity: 0.4,

      gradient: {
        0.2: '#22c55e', 
        0.5: '#eab308', 
        0.7: '#f97316', 
        1.0: '#ef4444', 
      },
    }).addTo(map)

    
    return () => {
      map.removeLayer(heat)
    }
  }, [points, map])

  return null
}

export default function HeatmapView({ grievances }) {


  const validPoints = grievances.filter(
    (g) =>
      g.latitude !== null &&
      g.longitude !== null &&
      !isNaN(Number(g.latitude)) &&
      !isNaN(Number(g.longitude)) &&

      // Madhya Pradesh bounds
      Number(g.latitude) >= 21 &&
      Number(g.latitude) <= 27.5 &&
      Number(g.longitude) >= 73 &&
      Number(g.longitude) <= 83
  )

  return (
    <MapContainer
      className="heatmap-map"
      center={[22.9734, 78.6569]}
      zoom={5}
      scrollWheelZoom={false}
      minZoom={5}
      maxBounds={[
        [21.0, 73.0],
        [27.5, 83.0]
      ]}
      maxBoundsViscosity={1.0}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <HeatLayer points={validPoints} />
    </MapContainer>
  )
}