'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { latLngBounds } from 'leaflet';
import { stateStyle } from '@dispatch/ui-tokens';
import type { AdminJobItem } from '@dispatch/contracts';

type Point = [number, number];

const pointsOf = (j: AdminJobItem): Point[] => {
  const p: Point[] = [[j.location.lat, j.location.lon]];
  if (j.technicianLocation) p.push([j.technicianLocation.lat, j.technicianLocation.lon]);
  return p;
};

/** Fits the view to `points` whenever `focusKey` changes (selected job, or the first time jobs arrive). */
function FitBounds({ points, focusKey }: { points: Point[]; focusKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(latLngBounds(points), { padding: [40, 40], maxZoom: 15, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only refit when the focus changes, not on every live update
  }, [focusKey, map]);
  return null;
}

/**
 * Requests are circles in their state colour; the assigned technician's last trusted position is a white ring
 * joined to the request by a dashed line. Selecting a row highlights its markers and zooms to them.
 */
export default function JobMap({
  jobs,
  selectedId,
  onSelect,
}: {
  jobs: AdminJobItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selected = jobs.find((j) => j.id === selectedId);
  const points = selected ? pointsOf(selected) : jobs.flatMap(pointsOf);
  const focusKey = selected ? `job:${selected.id}` : `all:${jobs.length > 0}`;

  return (
    <MapContainer
      center={[12.9716, 77.5946]}
      zoom={12}
      className="h-full min-h-[420px] w-full rounded-md"
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} focusKey={focusKey} />
      {jobs.map((j) => {
        const color = stateStyle(j.state, 'light').text;
        const isSelected = j.id === selectedId;
        return (
          <span key={j.id}>
            <CircleMarker
              center={[j.location.lat, j.location.lon]}
              radius={isSelected ? 12 : 8}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.7, weight: isSelected ? 4 : 1 }}
              eventHandlers={{ click: () => onSelect(j.id) }}
            >
              <Tooltip>
                {j.assetId} · {stateStyle(j.state).label}
              </Tooltip>
            </CircleMarker>
            {j.technicianLocation && (
              <>
                <CircleMarker
                  center={[j.technicianLocation.lat, j.technicianLocation.lon]}
                  radius={isSelected ? 8 : 6}
                  pathOptions={{ color: '#0f172a', fillColor: '#fff', fillOpacity: 1, weight: 3 }}
                >
                  <Tooltip>Technician {j.technician?.name}</Tooltip>
                </CircleMarker>
                <Polyline
                  positions={[
                    [j.location.lat, j.location.lon],
                    [j.technicianLocation.lat, j.technicianLocation.lon],
                  ]}
                  pathOptions={{ color, weight: isSelected ? 3 : 1, dashArray: '4' }}
                />
              </>
            )}
          </span>
        );
      })}
    </MapContainer>
  );
}
