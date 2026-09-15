"use client";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type EarthquakeMapItem = {
  id?: string | number;
  datetime?: string;
  latitude?: number | string;
  longitude?: number | string;
  magnitude?: number | string;
  depth?: number | string;
  cluster_id?: number | string;
  probability?: number | string;
  place?: string;
  location?: string;
};

function toNumber(value: number | string | undefined, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function toClusterIdValue(clusterId: number | string | undefined | null) {
  return clusterId === undefined || clusterId === null || clusterId === "" ? "noise" : String(clusterId);
}

const CLUSTER_PALETTE = [
  { fillColor: "#ef4444", strokeColor: "#7f1d1d" },
  { fillColor: "#2563eb", strokeColor: "#1e3a8a" },
  { fillColor: "#22c55e", strokeColor: "#14532d" },
  { fillColor: "#f59e0b", strokeColor: "#92400e" },
  { fillColor: "#8b5cf6", strokeColor: "#4c1d95" },
  { fillColor: "#06b6d4", strokeColor: "#155e75" },
  { fillColor: "#ec4899", strokeColor: "#831843" },
  { fillColor: "#84cc16", strokeColor: "#3f6212" },
  { fillColor: "#4f46e5", strokeColor: "#312e81" },
  { fillColor: "#14b8a6", strokeColor: "#134e4a" },
  { fillColor: "#fb923c", strokeColor: "#9a3412" },
  { fillColor: "#d946ef", strokeColor: "#701a75" },
  { fillColor: "#a855f7", strokeColor: "#581c87" },
  { fillColor: "#10b981", strokeColor: "#065f46" },
  { fillColor: "#eab308", strokeColor: "#854d0e" },
  { fillColor: "#f43f5e", strokeColor: "#881337" },
  { fillColor: "#0ea5e9", strokeColor: "#0c4a6e" },
  { fillColor: "#22d3ee", strokeColor: "#155e75" },
  { fillColor: "#a3e635", strokeColor: "#3f6212" },
  { fillColor: "#64748b", strokeColor: "#334155" },
];

function getPaletteColor(clusterIndex: number) {
  return CLUSTER_PALETTE[clusterIndex % CLUSTER_PALETTE.length];
}

function getGeneratedColor(clusterId: string) {
  const hash = [...clusterId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const hue = (hash * 137.508) % 360;

  return {
    fillColor: `hsl(${hue} 90% 56%)`,
    strokeColor: `hsl(${hue} 100% 26%)`,
  };
}

function getClusterStyles(clusterId: number | string | undefined | null) {
  const id = toClusterIdValue(clusterId);

  if (id === "noise") {
    return {
      fillColor: "#f8fafc",
      strokeColor: "#334155",
    };
  }

  const numericClusterId = Number(id);

  if (Number.isInteger(numericClusterId) && numericClusterId >= 0) {
    return getPaletteColor(numericClusterId);
  }

  return getGeneratedColor(id);
}

export default function EarthquakeMap({ points }: { points: EarthquakeMapItem[] }) {
  return (
    <MapContainer center={[-2, 118]} zoom={4} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {points.map((point, index) => {
        const latitude = toNumber(point.latitude);
        const longitude = toNumber(point.longitude);
        const magnitude = toNumber(point.magnitude);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        const clusterStyle = getClusterStyles(point.cluster_id);

        return (
          <CircleMarker
            key={`${point.id ?? point.datetime ?? index}-${point.cluster_id ?? "noise"}`}
            center={[latitude, longitude]}
            radius={Math.max(4, Math.min(12, magnitude * 2.4))}
            pathOptions={{
              color: clusterStyle.strokeColor,
              fillColor: clusterStyle.fillColor,
              fillOpacity: 0.98,
              opacity: 1,
              weight: 1.6,
            }}
          >
            <Popup>
              <div className="min-w-55 text-sm text-slate-800">
                <p className="mb-1 text-base font-bold">Cluster {toClusterIdValue(point.cluster_id)}</p>
                <p>
                  <span className="font-semibold">Lokasi:</span> {point.location ?? point.place ?? "-"}
                </p>
                <p>
                  <span className="font-semibold">Magnitudo:</span> {magnitude.toFixed(2)}
                </p>
                <p>
                  <span className="font-semibold">Kedalaman:</span> {toNumber(point.depth).toFixed(1)} km
                </p>
                <p>
                  <span className="font-semibold">Waktu:</span> {formatDate(point.datetime)}
                </p>
                <p>
                  <span className="font-semibold">Probability:</span> {toNumber(point.probability).toFixed(3)}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
