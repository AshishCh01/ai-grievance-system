import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'
import 'leaflet/dist/leaflet.css'

function bucketGrievances(grievances, cellSize = 0.02) {
  const buckets = new Map()

  for (const g of grievances) {
    const lat = Number(g.latitude)
    const lon = Number(g.longitude)

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

    const keyLat = Math.round(lat / cellSize) * cellSize
    const keyLon = Math.round(lon / cellSize) * cellSize

    const key = `${keyLat.toFixed(2)}:${keyLon.toFixed(2)}`

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

    const severity =
      count >= 11
        ? 'Critical'
        : count >= 6
        ? 'High'
        : count >= 3
        ? 'Medium'
        : 'Low'

    return {
      ...bucket,
      severity,
      weight:
        count >= 11
          ? 1
          : count >= 6
          ? 0.8
          : count >= 3
          ? 0.6
          : 0.35
    }
  })
}

function HeatLayer({ points }) {
  const map = useMap()

  useEffect(() => {
    if (!points.length) return

    const heat = L.heatLayer(points, {
      radius: 55,
      blur: 40,
      maxZoom: 12,
      minOpacity: 0.7,

      gradient: {
        0.2: '#22c55e',
        0.45: '#eab308',
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
      !isNaN(Number(g.longitude))
  )

  const clusteredPoints = useMemo(() => {
    return bucketGrievances(validPoints)
  }, [validPoints])


  const heatPoints = useMemo(() => {
  return clusteredPoints.flatMap((point) => {
    const intensity =
      point.severity === 'Critical'
        ? 1
        : point.severity === 'High'
        ? 0.8
        : point.severity === 'Medium'
        ? 0.6
        : 0.4

      return Array(12).fill([
        point.lat,
        point.lon,
        intensity,
      ])
    })
  }, [clusteredPoints])
  // const heatPoints = useMemo(() => {
  //   return clusteredPoints.map((point) => [
  //     point.lat,
  //     point.lon,
  //     point.weight,
  //   ])
  // }, [clusteredPoints])

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