'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SOCKET_EVENTS, type EventEnvelope } from '@dispatch/contracts';

export type LiveStatus = 'connecting' | 'live' | 'offline';
type Handler = (e: EventEnvelope) => void;

interface LiveValue {
  status: LiveStatus;
  /** Increments after every RE-connection; pages refetch their REST snapshot when it changes. */
  resync: number;
  subscribe: (h: Handler) => () => void;
  /** Joins a request's room (technician position updates). Re-joined after every reconnect; returns the leave function. */
  joinRequest: (requestId: string) => () => void;
}

const LiveContext = createContext<LiveValue>({
  status: 'connecting',
  resync: 0,
  subscribe: () => () => undefined,
  joinRequest: () => () => undefined,
});
export const useLive = (): LiveValue => useContext(LiveContext);

async function fetchToken(): Promise<{ token: string; apiUrl: string } | null> {
  try {
    const res = await fetch('/api/session/token', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as { token: string; apiUrl: string };
  } catch {
    return null;
  }
}

/** One Socket.io connection for the whole console: auto-reconnect, fresh token per connect, status for the UI. */
export function LiveProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const [resync, setResync] = useState(0);
  const handlers = useRef(new Set<Handler>());
  const seen = useRef(new Set<string>());
  const socketRef = useRef<Socket | undefined>(undefined);
  const rooms = useRef(new Map<string, number>());

  useEffect(() => {
    let socket: Socket | undefined;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let everConnected = false;
    let attempts = 0;

    const scheduleReconnect = () => {
      if (cancelled || !socket) return;
      attempts += 1;
      retry = setTimeout(() => socket?.connect(), Math.min(1000 * 2 ** Math.min(attempts, 4), 15_000));
    };

    void (async () => {
      const first = await fetchToken();
      if (cancelled) return;
      if (!first) {
        setStatus('offline');
        return;
      }
      socket = io(first.apiUrl, {
        transports: ['websocket'],
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10_000,
        // evaluated on every (re)connect: a fresh short-lived token each time
        auth: (cb) => {
          void fetchToken().then((t) => cb({ token: t?.token ?? '' }));
        },
      });
      socketRef.current = socket;
      socket.on('connect', () => {
        attempts = 0;
        for (const requestId of rooms.current.keys()) socket?.emit('request.subscribe', { requestId });
        setStatus('live');
        if (everConnected) setResync((n) => n + 1); // missed events: refetch the REST snapshot
        everConnected = true;
      });
      socket.on('disconnect', (reason) => {
        setStatus('offline');
        if (reason === 'io server disconnect') scheduleReconnect(); // e.g. access token expired
      });
      // Rejected handshake (expired token) is not retried by socket.io itself.
      socket.on('connect_error', () => {
        setStatus('offline');
        scheduleReconnect();
      });
      for (const type of SOCKET_EVENTS) {
        socket.on(type, (e: EventEnvelope) => {
          if (seen.current.has(e.eventId)) return; // at-least-once delivery: de-dupe
          seen.current.add(e.eventId);
          if (seen.current.size > 500) seen.current.delete(seen.current.values().next().value as string);
          handlers.current.forEach((h) => h(e));
        });
      }
    })();

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      socket?.close();
      socketRef.current = undefined;
    };
  }, []);

  const subscribe = useCallback((h: Handler) => {
    handlers.current.add(h);
    return () => handlers.current.delete(h);
  }, []);
  const joinRequest = useCallback((requestId: string) => {
    rooms.current.set(requestId, (rooms.current.get(requestId) ?? 0) + 1);
    if (socketRef.current?.connected) socketRef.current.emit('request.subscribe', { requestId });
    return () => {
      const left = (rooms.current.get(requestId) ?? 1) - 1;
      if (left > 0) {
        rooms.current.set(requestId, left);
        return;
      }
      rooms.current.delete(requestId);
      if (socketRef.current?.connected) socketRef.current.emit('request.unsubscribe', { requestId });
    };
  }, []);
  const value = useMemo(
    () => ({ status, resync, subscribe, joinRequest }),
    [status, resync, subscribe, joinRequest],
  );
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

/** Calls `onChange` (debounced) whenever a matching event arrives, and once after every reconnect. */
export function useLiveRefresh(onChange: () => void, filter?: (e: EventEnvelope) => boolean): void {
  const { subscribe, resync } = useLive();
  const cb = useRef(onChange);
  const flt = useRef(filter);
  useEffect(() => {
    cb.current = onChange;
    flt.current = filter;
  });
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = subscribe((e) => {
      if (flt.current && !flt.current(e)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cb.current(), 250);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, [subscribe]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    cb.current(); // reconnect => refetch the REST snapshot
  }, [resync]);
}

/** Receives live technician positions for one request (subscribes to its room while mounted). */
export function useRequestRoom(requestId: string | null, onEvent: Handler): void {
  const { joinRequest, subscribe } = useLive();
  const cb = useRef(onEvent);
  useEffect(() => {
    cb.current = onEvent;
  });
  useEffect(() => {
    if (!requestId) return;
    const leave = joinRequest(requestId);
    const off = subscribe((e) => {
      if (e.requestId === requestId) cb.current(e);
    });
    return () => {
      off();
      leave();
    };
  }, [requestId, joinRequest, subscribe]);
}
