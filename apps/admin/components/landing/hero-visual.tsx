import Image from 'next/image';
import { Camera, CheckCircle2, Clock, MapPin, Shield, Star } from 'lucide-react';

/**
 * Decorative product preview for the landing hero: a real dispatch platform screenshot
 * overlaid with floating UI cards showing live job state. Hidden from assistive tech.
 */
export function HeroVisual() {
  return (
    <div aria-hidden className="relative mx-auto aspect-[5/4] w-full max-w-xl select-none">
      {/* Hero image base */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl border border-line shadow-popover">
        <Image
          src="/hero-dispatch.jpg"
          alt=""
          fill
          className="object-cover"
          priority
          sizes="(max-width: 768px) 100vw, 580px"
        />
        {/* Subtle gradient overlay for card legibility */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.35) 100%)',
          }}
        />
      </div>

      {/* Technician card — top left */}
      <div className="absolute top-4 left-4 flex items-center gap-3 rounded-xl border border-white/20 bg-white/90 dark:bg-surface/90 p-3 shadow-popover backdrop-blur-sm">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-ink">
          AK
        </span>
        <div className="text-left">
          <p className="text-sm font-semibold text-ink">Nearest technician</p>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Star size={12} className="fill-current text-warning" /> 4.8 · 1.2 km · ₹465
          </p>
        </div>
      </div>

      {/* Live status badge — top right */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full border border-white/20 bg-white/90 dark:bg-surface/90 px-2.5 py-1 text-xs font-medium shadow-popover backdrop-blur-sm text-ink">
        <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
        Work in progress
      </div>

      {/* Arrival code card — bottom right */}
      <div className="absolute right-4 bottom-4 rounded-xl border border-white/20 bg-white/90 dark:bg-surface/90 p-3 shadow-popover backdrop-blur-sm">
        <p className="text-xs font-medium text-muted">Arrival code</p>
        <div className="mt-1.5 flex gap-1">
          {['5', '4', '8', '2', '7', '1'].map((d, i) => (
            <span
              key={i}
              className="flex h-8 w-6 items-center justify-center rounded-sm border border-line-strong font-mono text-base font-semibold bg-bg text-ink"
            >
              {d}
            </span>
          ))}
        </div>
      </div>

      {/* Photo proof & timer pills — bottom left */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/90 dark:bg-surface/90 px-3 py-1.5 text-xs font-medium shadow-popover backdrop-blur-sm text-ink">
          <Camera size={14} strokeWidth={1.75} className="text-primary" />
          2 photos uploaded
          <CheckCircle2 size={14} strokeWidth={1.75} className="text-success" />
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/90 dark:bg-surface/90 px-3 py-1.5 text-xs font-medium shadow-popover backdrop-blur-sm text-ink">
          <Clock size={14} strokeWidth={1.75} className="text-muted" />
          <span className="tabular-nums">00:42:17</span>
          <Shield size={14} strokeWidth={1.75} className="text-primary" />
        </div>
      </div>

      {/* Map pin decoration */}
      <span className="absolute top-[42%] right-[22%] flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary shadow-popover">
        <MapPin size={18} strokeWidth={2.2} />
      </span>
    </div>
  );
}
