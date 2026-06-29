import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import { RISK_COLORS, type RegionData, type RiskLevel } from "@/data/aegisData";

const LEGEND: { level: RiskLevel; label: string }[] = [
  { level: "critical", label: "Critical" },
  { level: "high", label: "High" },
  { level: "medium", label: "Medium" },
  { level: "low", label: "Low" },
];

/**
 * Dark world map of regional risk. Plots live region coordinates as glowing
 * CircleMarkers over CartoDB dark tiles (no marker image assets needed),
 * coloured by risk level and sized by incident volume.
 */
/** Only the geo + risk fields are needed to plot a marker. */
export type MapRegion = Pick<
  RegionData,
  "id" | "name" | "country" | "riskLevel" | "incidents" | "lat" | "lng"
>;

const WorldRiskMap = ({
  regions,
  height = 300,
  center = [12, 18],
  zoom = 2,
}: {
  regions: MapRegion[];
  height?: number;
  center?: [number, number];
  zoom?: number;
}) => {
  const points = regions.filter(
    (r) => Number.isFinite(r.lat) && Number.isFinite(r.lng),
  );

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-white/10"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={1}
        scrollWheelZoom={false}
        worldCopyJump
        style={{ height: "100%", width: "100%", background: "#070b18" }}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        {points.map((r) => {
          const color = RISK_COLORS[r.riskLevel];
          const radius = Math.max(6, Math.min(22, Math.sqrt(r.incidents) + 4));
          return (
            <CircleMarker
              key={r.id}
              center={[r.lat, r.lng]}
              radius={radius}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.55,
                weight: 2,
                opacity: 0.9,
              }}
            >
              <Tooltip direction="top" offset={[0, -4]}>
                {r.name} · {r.country} · {r.incidents} incidents
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] flex flex-col gap-1 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 backdrop-blur">
        {LEGEND.map((l) => (
          <span
            key={l.level}
            className="flex items-center gap-1.5 text-[10px] font-medium text-slate-300"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: RISK_COLORS[l.level] }}
            />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default WorldRiskMap;
