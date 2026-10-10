'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { latLngBounds } from 'leaflet';
import { DEFAULT_CENTER, type LatLon } from '@/lib/location';

export interface MapTechItem {
  id: string;
  name: string;
  lat: number;
  lon: number;
  rating?: number;
  availability?: string;
  categories?: string[];
}

export interface MapRequestItem {
  id: string;
  assetId: string;
  category?: string;
  state?: string;
  lat: number;
  lon: number;
  quote?: number;
}

function Clicks({ onPick }: { onPick: (p: LatLon) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lon: e.latlng.lng }) });
  return null;
}

/** Fits bounds for site, single technician, or lists of technicians & requests */
function Fit({
  site,
  technician,
  techniciansList,
  requestsList,
  fitKey,
}: {
  site: LatLon | null;
  technician: LatLon | null;
  techniciansList?: MapTechItem[];
  requestsList?: MapRequestItem[];
  fitKey: string;
}) {
  const map = useMap();
  useEffect(() => {
    const pts: [number, number][] = [];
    if (site) pts.push([site.lat, site.lon]);
    if (technician) pts.push([technician.lat, technician.lon]);
    if (techniciansList) {
      for (const t of techniciansList) {
        if (Number.isFinite(t.lat) && Number.isFinite(t.lon)) pts.push([t.lat, t.lon]);
      }
    }
    if (requestsList) {
      for (const r of requestsList) {
        if (Number.isFinite(r.lat) && Number.isFinite(r.lon)) pts.push([r.lat, r.lon]);
      }
    }
    if (pts.length === 0) return;
    if (pts.length === 1) map.setView(pts[0]!, Math.max(map.getZoom(), 13), { animate: false });
    else map.fitBounds(latLngBounds(pts), { padding: [40, 40], maxZoom: 15, animate: false });
  }, [fitKey, map]);
  return null;
}

export default function SiteMap({
  site = null,
  onPick,
  technician = null,
  techniciansList,
  requestsList,
  label,
  className,
}: {
  site?: LatLon | null;
  onPick?: (p: LatLon) => void;
  technician?: LatLon | null;
  techniciansList?: MapTechItem[];
  requestsList?: MapRequestItem[];
  label: string;
  className?: string;
}) {
  const center =
    site ??
    (techniciansList?.[0] ? { lat: techniciansList[0].lat, lon: techniciansList[0].lon } : DEFAULT_CENTER);
  const fitKey = `${site ? 1 : 0}-${technician ? 1 : 0}-${techniciansList?.length ?? 0}-${requestsList?.length ?? 0}-${onPick ? 'p' : 'v'}`;

  return (
    <MapContainer
      center={[center.lat, center.lon]}
      zoom={13}
      scrollWheelZoom={false}
      aria-label={label}
      className={className ?? 'h-full min-h-[260px] w-full rounded-xl'}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {onPick && <Clicks onPick={onPick} />}
      <Fit
        site={site}
        technician={technician}
        techniciansList={techniciansList}
        requestsList={requestsList}
        fitKey={fitKey}
      />

      {/* Main Single Site */}
      {site && (
        <CircleMarker
          center={[site.lat, site.lon]}
          radius={11}
          pathOptions={{ color: '#1E40AF', fillColor: '#3B82F6', fillOpacity: 0.9, weight: 3 }}
        >
          <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
            <div className="font-sans text-xs">
              <strong className="block text-blue-900">Client Site</strong>
              <span>
                {site.lat.toFixed(4)}, {site.lon.toFixed(4)}
              </span>
            </div>
          </Tooltip>
        </CircleMarker>
      )}

      {/* Line connecting primary technician to site */}
      {site && technician && (
        <>
          <Polyline
            positions={[
              [site.lat, site.lon],
              [technician.lat, technician.lon],
            ]}
            pathOptions={{ color: '#1E40AF', weight: 3, dashArray: '6, 6' }}
          />
          <CircleMarker
            center={[technician.lat, technician.lon]}
            radius={9}
            pathOptions={{ color: '#D97706', fillColor: '#F59E0B', fillOpacity: 1, weight: 3 }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <div className="font-sans text-xs">
                <strong className="block text-amber-900">Assigned Technician</strong>
                <span>En-route to client site</span>
              </div>
            </Tooltip>
          </CircleMarker>
        </>
      )}

      {/* Multiple Technicians List (for Clients to see all active technicians) */}
      {techniciansList?.map((t) => {
        const isAvail = t.availability === 'AVAILABLE';
        return (
          <CircleMarker
            key={t.id}
            center={[t.lat, t.lon]}
            radius={8}
            pathOptions={{
              color: isAvail ? '#15803D' : '#64748B',
              fillColor: isAvail ? '#22C55E' : '#94A3B8',
              fillOpacity: 0.9,
              weight: 2.5,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <div className="font-sans text-xs min-w-[120px]">
                <strong className="block text-slate-900">{t.name}</strong>
                <span className="text-[11px] text-slate-600 block">
                  {t.rating ? `★ ${t.rating.toFixed(1)} · ` : ''}
                  <span className={isAvail ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                    {isAvail ? 'Available' : 'Busy'}
                  </span>
                </span>
                {t.categories && t.categories.length > 0 && (
                  <span className="text-[10px] text-blue-700 block mt-0.5">{t.categories.join(', ')}</span>
                )}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}

      {/* Multiple Requests List (for Technicians to see client sites) */}
      {requestsList?.map((r) => (
        <CircleMarker
          key={r.id}
          center={[r.lat, r.lon]}
          radius={9}
          pathOptions={{
            color: '#D97706',
            fillColor: '#F59E0B',
            fillOpacity: 0.85,
            weight: 2.5,
          }}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            <div className="font-sans text-xs min-w-[130px]">
              <strong className="block text-slate-900">{r.assetId}</strong>
              <span className="text-[11px] text-amber-800 font-medium block">
                Status: {r.state ?? 'Active Request'}
              </span>
              {r.quote && (
                <span className="text-[10px] text-emerald-700 font-bold block">
                  Quote: ₹{(r.quote / 100).toFixed(0)}
                </span>
              )}
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
