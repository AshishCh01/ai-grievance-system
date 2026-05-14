import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function Picker({ setForm }) {
  useMapEvents({
    async click(e) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      );

      const data = await res.json();

      setForm((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        location: data.display_name || `${lat}, ${lng}`,
      }));
    },
  });

  return null;
}

export default function LocationPicker({ form, setForm }) {
  return (
    <div style={{ height: "300px", marginTop: "12px" }}>
      <MapContainer
        center={[23.2599, 77.4126]}
        zoom={12}
        style={{
          height: "100%",
          borderRadius: "18px",
        }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {form.latitude && form.longitude && (
          <Marker position={[Number(form.latitude), Number(form.longitude)]} />
        )}

        <Picker setForm={setForm} />
      </MapContainer>
    </div>
  );
}
