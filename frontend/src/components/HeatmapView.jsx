import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'
import 'leaflet/dist/leaflet.css'

const DEFAULT_CELL_SIZE = 0.12

function getDensityLabel(count) {
  if (count >= 11) return 'Critical'
  if (count >= 6) return 'High'
  if (count >= 3) return 'Medium'
  return 'Low'
}

function getDensityWeight(count) {
  if (count >= 11) return 1
  if (count >= 6) return 0.75
  if (count >= 3) return 0.5
  return 0.25
}

function bucketGrievances(points, cellSize = DEFAULT_CELL_SIZE) {
  const buckets = new Map()

  for (const point of points) {
    const lat = Number(point.lat)
    const lon = Number(point.lon)

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

    const keyLat = Number((Math.round(lat / cellSize) * cellSize).toFixed(4))
    const keyLon = Number((Math.round(lon / cellSize) * cellSize).toFixed(4))

    const key = `${keyLat.toFixed(4)}:${keyLon.toFixed(4)}`

    const current = buckets.get(key) || {
      lat: keyLat,
      lon: keyLon,
      count: 0,
    }

    current.count += 1

    buckets.set(key, current)
  }

  return [...buckets.values()].map((bucket) => {
    const count = bucket.count
    return {
      ...bucket,
      severity: getDensityLabel(count),
      weight: getDensityWeight(count),
    }
  })
}

function getLatLon(grievance) {
  const lat = Number(grievance?.latitude ?? grievance?.lat)
  const lon = Number(grievance?.longitude ?? grievance?.lng ?? grievance?.lon)

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { lat, lon }
}

function HeatLayer({ points }) {
  const map = useMap()

  useEffect(() => {
    if (!points.length) return

    const heat = L.heatLayer(points, {
      radius: 46,
      blur: 30,
      maxZoom: 12,
      max: 1,
      minOpacity: 0.4,
      gradient: {
        0.25: '#22c55e',
        0.5: '#eab308',
        0.75: '#f97316',
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
  const validPoints = useMemo(() => {
    const source = Array.isArray(grievances) ? grievances : []
    return source.map(getLatLon).filter(Boolean)
  }, [grievances])

  const clusteredPoints = useMemo(() => {
    return bucketGrievances(validPoints)
  }, [validPoints])

  const heatPoints = useMemo(() => {
    return clusteredPoints.map((point) => [
      point.lat,
      point.lon,
      point.weight,
    ])
  }, [clusteredPoints])
  

  return (
    <MapContainer
      className="heatmap-map"
      center={[22.9734, 78.6569]}
      zoom={5}
      scrollWheelZoom={false}
      minZoom={5}
      maxBounds={[
        [6.0, 68.0],
        [37.0, 97.0],
      ]}
      maxBoundsViscosity={1.0}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <HeatLayer points={heatPoints} />
    </MapContainer>
  )
}




// import { useEffect } from 'react'
// import { MapContainer, TileLayer, useMap } from 'react-leaflet'
// import L from 'leaflet'
// import 'leaflet.heat'
// import 'leaflet/dist/leaflet.css'

// function HeatLayer({ points }) {
//   const map = useMap()

//   useEffect(() => {
//     if (!points.length) return

//     const heat = L.heatLayer(heatPoints, {
//       radius: 30,
//       blur: 22,
//       maxZoom: 12,
//       minOpacity: 0.4,

//       gradient: {
//         0.2: '#22c55e', 
//         0.5: '#eab308', 
//         0.7: '#f97316', 
//         1.0: '#ef4444', 
//       },
//     }).addTo(map)

    
//     return () => {
//       map.removeLayer(heat)
//     }
//   }, [points, map])

//   return null
// }

// export default function HeatmapView({ grievances }) {


//   const validPoints = grievances.filter(
//     (g) =>
//       g.latitude !== null &&
//       g.longitude !== null &&
//       !isNaN(Number(g.latitude)) &&
//       !isNaN(Number(g.longitude)) &&

//       // Madhya Pradesh bounds
//       Number(g.latitude) >= 21 &&
//       Number(g.latitude) <= 27.5 &&
//       Number(g.longitude) >= 73 &&
//       Number(g.longitude) <= 83
//   )

//   return (
//     <MapContainer
//       className="heatmap-map"
//       center={[22.9734, 78.6569]}
//       zoom={5}
//       scrollWheelZoom={false}
//       minZoom={5}
//       maxBounds={[
//         [21.0, 73.0],
//         [27.5, 83.0]
//       ]}
//       maxBoundsViscosity={1.0}
//     >
//       <TileLayer
//         attribution="&copy; OpenStreetMap contributors"
//         url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
//       />

//       <HeatLayer points={validPoints} />
//     </MapContainer>
//   )
// }