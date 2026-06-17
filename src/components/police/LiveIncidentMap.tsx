import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import { cn } from "@/lib/utils";

export type MapPointKind =
  | "sos"
  | "high"
  | "medium"
  | "low"
  | "officer"
  | "shelter"
  | "hospital";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  kind: MapPointKind;
  label?: string;
}

const KIND: Record<
  MapPointKind,
  { color: string; radius: number; label: string }
> = {
  sos: { color: "#f43f5e", radius: 9, label: "SOS alert" },
  high: { color: "#fb923c", radius: 7, label: "High risk" },
  medium: { color: "#fbbf24", radius: 6, label: "Medium risk" },
  low: { color: "#34d399", radius: 6, label: "Low risk" },
  officer: { color: "#38bdf8", radius: 5, label: "Police unit" },
  shelter: { color: "#a855f7", radius: 5, label: "Shelter" },
  hospital: { color: "#22d3ee", radius: 5, label: "Hospital" },
};

const LEGEND: MapPointKind[] = [
  "sos",
  "high",
  "medium",
  "low",
  "officer",
  "shelter",
  "hospital",
];

/**
 * Live operational map. Plots whatever points carry coordinates (SOS/incidents
 * with GPS, located units & facilities) over dark CartoDB tiles. Uses
 * CircleMarkers so no marker image assets are needed in the bundle.
 */
export function LiveIncidentMap({
  points,
  center = [-26.2041, 28.0473], // Johannesburg
  zoom = 11,
  height = 440,
  className,
}: {
  points: MapPoint[];
  center?: [number, number];
  zoom?: number;
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10",
        className,
      )}
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", background: "#0A0A1F" }}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        {points.map((p) => {
          const k = KIND[p.kind];
          return (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={k.radius}
              pathOptions={{
                color: k.color,
                fillColor: k.color,
                fillOpacity: 0.85,
                weight: 1.5,
                opacity: 0.95,
              }}
            >
              {p.label ? (
                <Tooltip direction="top" offset={[0, -4]}>
                  {p.label}
                </Tooltip>
              ) : null}
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-2 left-2 right-2 z-[1000] flex flex-wrap gap-x-3 gap-y-1 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 backdrop-blur">
        {LEGEND.map((kind) => (
          <span
            key={kind}
            className="flex items-center gap-1.5 text-[10px] font-medium text-slate-300"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: KIND[kind].color }}
            />
            {KIND[kind].label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default LiveIncidentMap;
