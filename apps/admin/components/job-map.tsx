'use client';

import 'leaflet/dist/leaflet.css';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import type { AdminJobItem } from '@dispatch/contracts';
import { humanize } from '@/lib/format.ts';

const TONE_COLOR: Record<string, string> = {
  neutral: '#64748b',
  info: '#2563eb',
  warn: '#d97706',
  good: '#16a34a',
  bad: '#dc2626',
};

function colorFor(job: AdminJobItem): string {
  if (job.exceptionFlags.length > 0) return TONE_COLOR.bad!;
  if (['SETTLED', 'COMPLETED'].includes(job.state)) return TONE_COLOR.good!;
  if (['IN_PROGRESS', 'PROOF_UPLOADED', 'UNDER_REVIEW'].includes(job.state)) return TONE_COLOR.warn!;
  if (['CONFIRMED', 'ARRIVED', 'MATCHED'].includes(job.state)) return TONE_COLOR.info!;
  return TONE_COLOR.neutral!;
}

/** Requests are circles coloured by state; the assigned technician's last trusted position is a ring joined by a line. */
export default function JobMap({
  jobs,
  selectedId,
  onSelect,
}: {
  jobs: AdminJobItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const centre: [number, number] = jobs[0]
    ? [jobs[0].location.lat, jobs[0].location.lon]
    : [12.9716, 77.5946];
  return (
    <MapContainer center={centre} zoom={12} className="h-[420px] w-full rounded-lg" scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {jobs.map((j) => {
        const color = colorFor(j);
        const selected = j.id === selectedId;
        return (
          <span key={j.id}>
            <CircleMarker
              center={[j.location.lat, j.location.lon]}
              radius={selected ? 12 : 8}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.7, weight: selected ? 3 : 1 }}
              eventHandlers={{ click: () => onSelect(j.id) }}
            >
              <Tooltip>
                {j.assetId} · {humanize(j.state)}
              </Tooltip>
            </CircleMarker>
            {j.technicianLocation && (
              <>
                <CircleMarker
                  center={[j.technicianLocation.lat, j.technicianLocation.lon]}
                  radius={6}
                  pathOptions={{ color: '#0f172a', fillColor: '#fff', fillOpacity: 1, weight: 3 }}
                >
                  <Tooltip>Technician {j.technician?.name}</Tooltip>
                </CircleMarker>
                <Polyline
                  positions={[
                    [j.location.lat, j.location.lon],
                    [j.technicianLocation.lat, j.technicianLocation.lon],
                  ]}
                  pathOptions={{ color, weight: 1, dashArray: '4' }}
                />
              </>
            )}
          </span>
        );
      })}
    </MapContainer>
  );
}
