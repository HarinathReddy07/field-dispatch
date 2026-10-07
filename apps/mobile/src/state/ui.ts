import { create } from 'zustand';

export interface LivePosition {
  lat: number;
  lon: number;
  at: string;
}

interface UiState {
  /** Socket connection state, for the offline banner. */
  live: 'connecting' | 'live' | 'offline';
  /** Latest technician positions by request id (from technician.location.updated). */
  positions: Record<string, LivePosition>;
  /** Dev-only: simulated GPS playback running. */
  simulating: boolean;
  setLive: (s: UiState['live']) => void;
  setPosition: (requestId: string, p: LivePosition) => void;
  setSimulating: (b: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  live: 'connecting',
  positions: {},
  simulating: false,
  setLive: (live) => set({ live }),
  setPosition: (requestId, p) => set((s) => ({ positions: { ...s.positions, [requestId]: p } })),
  setSimulating: (simulating) => set({ simulating }),
}));
