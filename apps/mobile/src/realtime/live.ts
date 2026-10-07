import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { SOCKET_EVENTS, type EventEnvelope } from '@dispatch/contracts';
import { api } from '../api/instance';
import { useUi } from '../state/ui';

let socket: Socket | null = null;
export const getSocket = (): Socket | null => socket;

/**
 * One Socket.io connection for the signed-in user. Events only tell us WHAT changed; the data itself always
 * comes from REST (no optimistic UI for state transitions). After a reconnect everything is refetched (resync).
 */
export function useLiveEvents(enabled: boolean): void {
  const qc = useQueryClient();
  const { setLive, setPosition } = useUi.getState();

  useEffect(() => {
    if (!enabled) return;
    const s = io(api.baseUrl, {
      transports: ['websocket'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
      // a fresh (refreshed if needed) access token on every (re)connect
      auth: (cb) => {
        void api.freshAccessToken().then((token) => cb({ token: token ?? '' }));
      },
    });
    socket = s;
    const seen = new Set<string>();
    let everConnected = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    s.on('connect', () => {
      setLive('live');
      if (everConnected) void qc.invalidateQueries(); // missed events: resync from REST
      everConnected = true;
    });
    s.on('disconnect', (reason) => {
      setLive('offline');
      if (reason === 'io server disconnect') retry = setTimeout(() => s.connect(), 500); // token expired
    });
    s.on('connect_error', () => {
      setLive('offline');
      retry = setTimeout(() => s.connect(), 3000);
    });
    for (const type of SOCKET_EVENTS) {
      s.on(type, (e: EventEnvelope) => {
        if (seen.has(e.eventId)) return; // at-least-once delivery
        seen.add(e.eventId);
        if (type === 'technician.location.updated' && e.requestId) {
          const d = e.data as { lat: number; lon: number; at: string };
          setPosition(e.requestId, { lat: d.lat, lon: d.lon, at: d.at });
          return;
        }
        if (e.requestId) void qc.invalidateQueries({ queryKey: ['request', e.requestId] });
        void qc.invalidateQueries({ queryKey: ['active'] });
        void qc.invalidateQueries({ queryKey: ['history'] });
        if (type === 'evidence.uploaded' && e.requestId)
          void qc.invalidateQueries({ queryKey: ['evidence', e.requestId] });
      });
    }
    return () => {
      if (retry) clearTimeout(retry);
      s.close();
      socket = null;
    };
  }, [enabled, qc, setLive, setPosition]);
}

/** Joins the live room of one request (server-side authorized; unauthorized joins are ignored by the server). */
export function useRequestRoom(requestId: string): void {
  const live = useUi((s) => s.live);
  useEffect(() => {
    if (live !== 'live') return;
    getSocket()?.emit('request.subscribe', { requestId });
    return () => {
      getSocket()?.emit('request.unsubscribe', { requestId });
    };
  }, [requestId, live]);
}
