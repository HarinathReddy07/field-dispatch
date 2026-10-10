'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Camera,
  CheckCircle,
  ChevronDown,
  ClipboardList,
  Clock,
  Compass,
  Cpu,
  DollarSign,
  Headphones,
  KeyRound,
  Laptop,
  Mail,
  MapPin,
  Menu,
  Navigation,
  Phone,
  Radio,
  ScrollText,
  Shield,
  ShieldCheck,
  Star,
  Timer,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@dispatch/contracts';
import { ThemeToggle } from '../shell';
import { homeFor } from '@/lib/roles';
import { SiteMap, type MapTechItem, type MapRequestItem } from '../portal/site-map-loader';
import { HeroVisual } from './hero-visual';

// ─── Social Media Icons (High-Precision SVGs) ──────────────────────────────

function TwitterIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
    </svg>
  );
}

function GitHubIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

function YouTubeIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function InstagramIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

// ─── Data ──────────────────────────────────────────────────────────────────

const DEMO_MAP_TECHS: MapTechItem[] = [
  {
    id: 't-1',
    name: 'Anil Kumar (T1)',
    lat: 12.9716,
    lon: 77.5946,
    rating: 4.9,
    availability: 'AVAILABLE',
    categories: ['Electrical', 'High Voltage'],
  },
  {
    id: 't-2',
    name: 'Arjun Verma (T2)',
    lat: 12.9854,
    lon: 77.6321,
    rating: 4.8,
    availability: 'AVAILABLE',
    categories: ['Mechanical', 'Turbines'],
  },
  {
    id: 't-3',
    name: 'Priya Sharma (T3)',
    lat: 12.9352,
    lon: 77.6245,
    rating: 4.9,
    availability: 'AVAILABLE',
    categories: ['HVAC', 'Refrigeration'],
  },
  {
    id: 't-4',
    name: 'Vikram Rao (T4)',
    lat: 12.925,
    lon: 77.5938,
    rating: 4.7,
    availability: 'BUSY',
    categories: ['Solar PV', 'Inverters'],
  },
  {
    id: 't-5',
    name: 'Suresh Nair (T5)',
    lat: 13.0035,
    lon: 77.5646,
    rating: 4.8,
    availability: 'AVAILABLE',
    categories: ['Electrical', 'Substations'],
  },
];

const DEMO_MAP_REQUESTS: MapRequestItem[] = [
  {
    id: 'r-1',
    assetId: 'TECH-PARK-GENSET-01',
    state: 'MATCHING',
    category: 'ELECTRICAL_INSPECTION',
    lat: 12.9784,
    lon: 77.6408,
    quote: 85000,
  },
  {
    id: 'r-2',
    assetId: 'CHILLER-ROOF-UNIT-4',
    state: 'IN_PROGRESS',
    category: 'MECHANICAL_INSPECTION',
    lat: 12.942,
    lon: 77.618,
    quote: 120000,
  },
];

const SERVICES = [
  {
    icon: Zap,
    title: 'Electrical Inspection',
    tag: 'High & Low Voltage',
    desc: 'Panels, switchgears, transformers, MCB diagnostics, and regulatory safety compliance certification.',
    price: 'from ₹800',
    image: '/service-electrical.jpg',
    eta: '15-25 min',
    categoryParam: 'ELECTRICAL_INSPECTION',
  },
  {
    icon: Wrench,
    title: 'Mechanical & Machinery',
    tag: 'Turbines & Motors',
    desc: 'Industrial pumps, bearings, rotating machinery, vibration analysis, and preventive maintenance diagnostics.',
    price: 'from ₹1,200',
    image: '/service-mechanical.jpg',
    eta: '20-30 min',
    categoryParam: 'MECHANICAL_INSPECTION',
  },
  {
    icon: Cpu,
    title: 'Commercial HVAC & Climate',
    tag: 'Chillers & AHU',
    desc: 'Rooftop chiller units, refrigeration compressors, building airflow balancing, and air-quality audits.',
    price: 'from ₹1,100',
    image: '/service-hvac.jpg',
    eta: '25-35 min',
    categoryParam: 'MECHANICAL_INSPECTION',
  },
  {
    icon: Compass,
    title: 'Solar PV & Clean Power',
    tag: 'Inverters & Arrays',
    desc: 'Photovoltaic panels, string inverters, battery backup diagnostics, and rooftop electrical feed checks.',
    price: 'from ₹950',
    image: '/service-solar.jpg',
    eta: '20-30 min',
    categoryParam: 'ELECTRICAL_INSPECTION',
  },
];

const PORTALS = [
  {
    role: 'Client / Requester Portal',
    badge: 'Customer Hub',
    title: 'Book, Track & Approve With Confidence',
    desc: 'For facility managers, enterprise operations, and property owners. Book certified field engineers in 60 seconds, track arriving technicians live on the map, provide your 6-digit arrival OTP, and inspect high-resolution evidence photos before payment approval.',
    href: '/app',
    loginAlias: 'c1',
    features: [
      'Interactive service request flow with automated server pricing',
      'Live map with arriving technician GPS and 6-digit OTP code',
      'Before & after inspection photo review with zoom inspector',
      'Downloadable itemized PDF / tax receipts upon completion',
    ],
    cta: 'Enter Client Portal',
    image: '/inspection-technician.jpg',
  },
  {
    role: 'Technician Field Portal',
    badge: 'Field Engineer Hub',
    title: 'Accept Jobs, Navigate & Earn Promptly',
    desc: 'Built specifically for mobile field technicians. Set your live availability, receive dispatch notifications near your GPS coordinate, confirm arrival with client OTP verification, upload tamper-evident evidence photos, and receive guaranteed payouts within 24 hours.',
    href: '/tech',
    loginAlias: 't1',
    features: [
      'Real-time job offers ranked by proximity and transparent pay',
      'Turn-by-turn map navigation to client site coordinates',
      'Offline-capable photo capture with cryptographically signed hashes',
      'Direct daily settlement tracking and earnings ledger',
    ],
    cta: 'Enter Technician Portal',
    image: '/fleet-map.jpg',
  },
  {
    role: 'Admin Operations Command',
    badge: 'Dispatcher & Fleet Console',
    title: 'Real-Time Fleet Oversight & SLA Control',
    desc: 'A high-performance command center for dispatch coordinators and operational executives. Monitor city-wide field coverage, oversee live active jobs across all states, override assignments during peak emergencies, and inspect immutable audit trails.',
    href: '/admin',
    loginAlias: 'admin',
    features: [
      'Live fleet tracking with real-time technician telemetry',
      'Configurable SLA radii, timeout windows, and OTP policies',
      'Complete settlement registry with minor-unit accounting precision',
      'Full audit event replay stream with actor correlation IDs',
    ],
    cta: 'Enter Admin Console',
    image: '/operations-command.jpg',
  },
];

const STEPS = [
  {
    n: '01',
    icon: ClipboardList,
    title: 'Describe the job',
    text: 'Enter your asset ID, choose the service category, pin your site on the interactive map, and pick a time window.',
  },
  {
    n: '02',
    icon: UserCheck,
    title: 'Pick a verified tech',
    text: 'Our proximity engine ranks nearby technicians by real distance, rating, and a fixed server-calculated quote.',
  },
  {
    n: '03',
    icon: KeyRound,
    title: 'Verify arrival with OTP',
    text: 'Share your unique 6-digit code when the technician arrives — work only starts after this cryptographic handshake.',
  },
  {
    n: '04',
    icon: CheckCircle,
    title: 'Approve & settle',
    text: 'Review mandatory photo evidence, approve the work, and settle automatically. Pay only when 100% satisfied.',
  },
];

const TRUST = [
  {
    icon: KeyRound,
    title: 'OTP Arrival Verification',
    text: 'A one-time 6-digit code, exclusive to you, proves the technician is physically on-site before work begins.',
  },
  {
    icon: Timer,
    title: 'Server-Authoritative Clock',
    text: 'Work duration is computed by server timestamps — immune to client clock drift, tampering, or offline glitches.',
  },
  {
    icon: Camera,
    title: 'Mandatory Photo Proof',
    text: 'Every inspection requires verified before/after photographic proof uploaded directly through the field app.',
  },
  {
    icon: ScrollText,
    title: 'Immutable Audit Trail',
    text: 'Every dispatch state transition and settlement is recorded with non-repudiable audit logs permanently.',
  },
];

const FAQS = [
  {
    q: 'How is the service quote calculated?',
    a: 'Rates are computed transparently on the server from a base fee per category, plus a distance component per kilometre from the technician. The quoted amount is locked when you confirm and cannot be altered afterwards.',
  },
  {
    q: "What if I'm not satisfied with the work?",
    a: 'You can request rework directly from the review screen with specific notes. The technician must re-perform the step and upload fresh photos before you approve. You pay nothing until you explicitly sign off.',
  },
  {
    q: 'How does the arrival OTP work?',
    a: 'When a technician reaches your physical site, you show a unique 6-digit code displayed securely on your screen. The technician enters it into their mobile portal, verifying presence. The code expires in 5 minutes and locks after wrong attempts.',
  },
  {
    q: 'Can I cancel after booking?',
    a: 'Yes. You can cancel at any point before on-site work begins. A standard nominal cancellation fee applies only if the technician has already arrived on site.',
  },
  {
    q: 'How are technicians vetted?',
    a: 'Every technician undergoes comprehensive national identity verification, category certification checks, and background vetting. Technicians must maintain a rating above 4.0 to remain active in the dispatch pool.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[var(--color-border)] last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors duration-150"
      >
        <span>{q}</span>
        <ChevronDown
          size={18}
          strokeWidth={2}
          className={`shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 ${open ? 'rotate-180 text-[var(--color-primary)]' : ''}`}
        />
      </button>
      {open && <p className="pb-4 text-xs leading-relaxed text-[var(--color-text-muted)]">{a}</p>}
    </div>
  );
}

// ─── Main Landing Component ───────────────────────────────────────────────

export function Landing({ user }: { user: { name: string; role: Role } | null }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] antialiased transition-colors duration-200">
      {/* ── Sticky Grand Royal Header ── */}
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-md shadow-sm">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-5">
          {/* Brand Logo with Royal Insignia */}
          <Link href="/" className="flex items-center gap-3 font-bold group">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 via-indigo-700 to-blue-900 text-base font-black text-white shadow-md shadow-blue-900/30 ring-2 ring-amber-400/30">
              FD
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-400 ring-2 ring-[var(--color-surface)]" />
            </span>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight text-[var(--color-text)] leading-none group-hover:text-[var(--color-primary)] transition-colors">
                FieldDispatch
              </span>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 tracking-wider uppercase mt-0.5">
                Royal Enterprise Network
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-7 text-sm font-semibold text-[var(--color-text-muted)] lg:flex">
            <a href="#services" className="hover:text-[var(--color-primary)] transition-colors">
              Services
            </a>
            <a href="#map-preview" className="hover:text-[var(--color-primary)] transition-colors">
              Live Map
            </a>
            <a href="#about" className="hover:text-[var(--color-primary)] transition-colors">
              About Us
            </a>
            <a href="#portals" className="hover:text-[var(--color-primary)] transition-colors">
              Portals
            </a>
            <a href="#how" className="hover:text-[var(--color-primary)] transition-colors">
              How It Works
            </a>
            <a href="#faq" className="hover:text-[var(--color-primary)] transition-colors">
              FAQ
            </a>
          </nav>

          {/* Action CTAs & Dark/Light Mode Toggle */}
          <div className="hidden items-center gap-3 sm:flex">
            <ThemeToggle />
            {user ? (
              <Link
                href={homeFor(user.role)}
                className="rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-700/20 hover:from-blue-800 hover:to-indigo-800 transition-all"
              >
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-700/25 hover:from-blue-800 hover:to-indigo-800 transition-all"
                >
                  Book Inspection
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="flex items-center gap-2 sm:hidden">
            <ThemeToggle />
            <button
              className="rounded-xl p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileOpen && (
          <nav className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 lg:hidden shadow-xl">
            <div className="flex flex-col gap-3.5 text-sm font-semibold">
              {[
                { href: '#services', label: 'Services' },
                { href: '#map-preview', label: 'Live Fleet Map' },
                { href: '#about', label: 'About Us' },
                { href: '#portals', label: 'Dedicated Portals' },
                { href: '#how', label: 'How It Works' },
                { href: '#faq', label: 'FAQ' },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="py-1 text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                >
                  {item.label}
                </a>
              ))}
              <div className="mt-3 flex gap-2 border-t border-[var(--color-border)] pt-4">
                <Link
                  href="/login"
                  className="flex-1 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-center text-sm font-bold"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="flex-1 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 px-4 py-2.5 text-center text-sm font-bold text-white"
                >
                  Book now
                </Link>
              </div>
            </div>
          </nav>
        )}
      </header>

      {/* ── Grand Royal Hero Section ── */}
      <section className="relative overflow-hidden border-b border-[var(--color-border)] bg-gradient-to-b from-blue-100/40 via-[var(--color-bg)] to-[var(--color-bg)] dark:from-[#0B1530] dark:via-[var(--color-bg)] dark:to-[var(--color-bg)]">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 md:py-24 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              ISO 9001:2015 Certified Fleet · AES-256 Arrival Handshake
            </div>

            <h1 className="mt-5 text-4xl font-black leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl text-[var(--color-text)]">
              Verified field technicians,{' '}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                dispatched in minutes.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--color-text-muted)]">
              Connect facility managers with rated industrial technicians for electrical panels, heavy
              machinery, rooftop HVAC, and clean energy arrays. Verified on-site arrival via cryptographic OTP
              and tamper-proof photo audit proof before payment.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-700/25 hover:from-blue-800 hover:to-indigo-800 hover:shadow-xl transition-all"
              >
                Book an Inspection <ArrowRight size={17} />
              </Link>
              <a
                href="#portals"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-6 py-3.5 text-sm font-bold text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] transition-colors shadow-sm"
              >
                Explore All 3 Portals
              </a>
            </div>

            {/* Quick trust metrics */}
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-[var(--color-border)] pt-6">
              {[
                { val: '< 15 min', label: 'Median match time' },
                { val: '4.89 ★', label: 'Average tech rating' },
                { val: '100%', label: 'OTP-verified on site' },
                { val: '₹0', label: 'Charged on disapproval' },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-xl font-black text-[var(--color-primary)]">{s.val}</p>
                  <p className="text-[11px] font-medium text-[var(--color-text-muted)]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Hero Visual Mockup */}
          <div className="relative">
            <HeroVisual />
          </div>
        </div>
      </section>

      {/* ── Services Showcase (With High-Resolution Photography) ── */}
      <section id="services" className="mx-auto max-w-7xl px-5 py-20">
        <div className="mb-12 text-center">
          <span className="inline-block rounded-full bg-blue-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
            Certified Specialized Field Engineering
          </span>
          <h2 className="mt-3 text-3xl font-black text-[var(--color-text)] sm:text-4xl">
            Our Core Field Inspection Services
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-text-muted)]">
            Every inspection is performed by certified engineers equipped with calibrated testing gear and
            strict safety compliance checklists.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-[var(--color-primary)]/50"
              >
                {/* Real High-Resolution Image Header */}
                <div className="relative h-48 w-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                  <Image
                    src={s.image}
                    alt={s.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                  <span className="absolute bottom-2.5 left-3 rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-bold text-slate-900 backdrop-blur-sm">
                    {s.tag}
                  </span>
                  <span className="absolute top-2.5 right-3 flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                    <Clock size={11} /> {s.eta}
                  </span>
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                      <Icon size={16} strokeWidth={2.25} />
                    </span>
                    <h3 className="font-bold text-base text-[var(--color-text)] leading-snug">{s.title}</h3>
                  </div>

                  <p className="flex-1 text-xs leading-relaxed text-[var(--color-text-muted)] mb-4">
                    {s.desc}
                  </p>

                  <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3 mt-auto">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-[var(--color-text-muted)]">
                        Locked quote
                      </span>
                      <span className="text-sm font-black text-[var(--color-primary)]">{s.price}</span>
                    </div>
                    <Link
                      href={`/app/new?category=${s.categoryParam}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[var(--color-primary-hover)] transition-colors shadow-sm"
                    >
                      Book <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Live Interactive Map Section (Clients see Technicians, Technicians see Clients) ── */}
      <section
        id="map-preview"
        className="border-y border-[var(--color-border)] bg-[var(--color-surface)] py-20"
      >
        <div className="mx-auto max-w-7xl px-5">
          <div className="grid gap-12 lg:grid-cols-12 items-center">
            <div className="lg:col-span-5">
              <span className="inline-block rounded-full bg-emerald-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Geospatial Fleet Coverage
              </span>
              <h2 className="mt-3 text-3xl font-black text-[var(--color-text)] sm:text-4xl leading-tight">
                Real-Time Proximity Dispatch & Live GPS Tracking
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
                Our PostGIS spatial matching engine enables clients to view nearby available technicians and
                track their real-time arrival. Simultaneously, technicians view client inspection site
                requests within their custom dispatch radius.
              </p>

              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3.5">
                  <span className="h-3 w-3 rounded-full bg-emerald-500 mt-1 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-[var(--color-text)]">
                      Green Markers: Available Technicians
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      Rated specialists online and ready for instant dispatch.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3.5">
                  <span className="h-3 w-3 rounded-full bg-amber-500 mt-1 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-[var(--color-text)]">
                      Amber Markers: Client Inspection Sites
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      Active asset requests awaiting technician arrival and verification.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <Link
                  href="/app"
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[var(--color-primary-hover)] transition-all"
                >
                  View Client Portal Map →
                </Link>
                <Link
                  href="/tech"
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border-strong)] px-5 py-2.5 text-xs font-bold text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] transition-colors"
                >
                  View Tech Portal Map →
                </Link>
              </div>
            </div>

            {/* Interactive Leaflet Map */}
            <div className="lg:col-span-7 overflow-hidden rounded-2xl border border-[var(--color-border)] shadow-xl bg-[var(--color-surface)]">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-[var(--color-text)]">
                    Live Fleet Telemetry: Bengaluru Metropolitan Hub
                  </span>
                </div>
                <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                  5 Techs Online · 2 Active Dispatches
                </span>
              </div>
              <div className="h-96 w-full">
                <SiteMap
                  techniciansList={DEMO_MAP_TECHS}
                  requestsList={DEMO_MAP_REQUESTS}
                  label="Live fleet preview map"
                  className="h-full w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── About Us Section (With Rich Photography) ── */}
      <section id="about" className="mx-auto max-w-7xl px-5 py-20">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <div>
            <span className="inline-block rounded-full bg-blue-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
              About FieldDispatch
            </span>
            <h2 className="mt-3 text-3xl font-black text-[var(--color-text)] sm:text-4xl leading-tight">
              Pioneering Industrial-Grade Verification & Enterprise Field Engineering
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
              FieldDispatch was founded to solve a pervasive problem across commercial infrastructure:
              unverified work claims, inflated bills, and unverified contractor arrivals.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
              We replaced verbal agreements with server-authoritative rates, cryptographic 6-digit arrival
              codes, and tamper-evident photographic audit trails. Every field technician in our network is
              identity-verified, certified, and held to strict ISO 9001 quality benchmarks.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)] mb-2.5">
                  <ShieldCheck size={20} />
                </div>
                <h4 className="font-bold text-sm text-[var(--color-text)]">ISO 9001 Compliance</h4>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Standardized calibration protocols and safety gear verification for every job.
                </p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-2.5">
                  <KeyRound size={20} />
                </div>
                <h4 className="font-bold text-sm text-[var(--color-text)]">Cryptographic Handshake</h4>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Work begins only after the client shares their unique 6-digit arrival OTP code.
                </p>
              </div>
            </div>
          </div>

          {/* High-Resolution About Images */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="relative h-72 sm:h-80 overflow-hidden rounded-2xl border border-[var(--color-border)] shadow-lg">
              <Image
                src="/operations-command.jpg"
                alt="24/7 Dispatch Operations Command Center"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <p className="text-xs font-bold">24/7 Dispatch Command</p>
                <p className="text-[11px] text-white/80">Continuous network monitoring</p>
              </div>
            </div>

            <div className="relative h-72 sm:h-80 overflow-hidden rounded-2xl border border-[var(--color-border)] shadow-lg mt-0 sm:mt-8">
              <Image
                src="/inspection-technician.jpg"
                alt="Certified Field Inspection Engineer"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <p className="text-xs font-bold">Certified Field Engineers</p>
                <p className="text-[11px] text-white/80">On-site precision diagnostics</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Three Dedicated Portals Showcase ── */}
      <section
        id="portals"
        className="border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] py-20"
      >
        <div className="mx-auto max-w-7xl px-5">
          <div className="mb-12 text-center">
            <span className="inline-block rounded-full bg-blue-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
              Tailored Portals
            </span>
            <h2 className="mt-3 text-3xl font-black text-[var(--color-text)] sm:text-4xl">
              Three Dedicated Portals Built for Each Role
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-text-muted)]">
              Whether you are requesting inspections as a client, servicing equipment as a technician, or
              directing fleet logistics as an admin, our platform provides dedicated tools.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {PORTALS.map((p) => (
              <div
                key={p.role}
                className="flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-md transition-all duration-300 hover:shadow-xl hover:border-[var(--color-primary)]/50"
              >
                <div className="relative h-48 w-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                  <Image src={p.image} alt={p.role} fill className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute top-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-slate-900 shadow-sm">
                    {p.badge}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-lg font-bold text-[var(--color-text)]">{p.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-muted)]">{p.desc}</p>

                  <ul className="mt-4 space-y-2 border-t border-[var(--color-border)] pt-4 mb-6">
                    {p.features.map((feat) => (
                      <li
                        key={feat}
                        className="flex items-start gap-2 text-xs text-[var(--color-text-muted)]"
                      >
                        <CheckCircle size={14} className="text-[var(--color-primary)] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-2">
                    <Link
                      href={p.href}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 py-2.5 text-sm font-bold text-white shadow-md hover:from-blue-800 hover:to-indigo-800 transition-all"
                    >
                      {p.cta} <ArrowRight size={15} />
                    </Link>
                    <p className="mt-2 text-center text-[11px] text-[var(--color-text-muted)]">
                      Quick login shortcut:{' '}
                      <span className="font-mono font-bold text-[var(--color-primary)]">{p.loginAlias}</span>{' '}
                      (password: <code className="text-xs">Passw0rd!dev</code>)
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how" className="mx-auto max-w-7xl px-5 py-20">
        <div className="mb-12 text-center">
          <span className="inline-block rounded-full bg-blue-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
            Transparent Workflow
          </span>
          <h2 className="mt-3 text-3xl font-black text-[var(--color-text)] sm:text-4xl">
            Four Steps from Request to Settle
          </h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.n}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm transition-shadow duration-200 hover:shadow-lg"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                    <Icon size={22} strokeWidth={2} />
                  </div>
                  <span className="text-3xl font-black text-[var(--color-border-strong)] tabular-nums">
                    {s.n}
                  </span>
                </div>
                <h3 className="font-bold text-base text-[var(--color-text)]">{s.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-muted)]">{s.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="border-t border-[var(--color-border)] bg-[var(--color-surface)] py-20">
        <div className="mx-auto max-w-3xl px-5">
          <div className="mb-10 text-center">
            <span className="inline-block rounded-full bg-blue-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
              Got Questions?
            </span>
            <h2 className="mt-3 text-3xl font-black text-[var(--color-text)]">Frequently Asked Questions</h2>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 shadow-sm">
            {FAQS.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Grand Corporate Footer with ALL Social Media Handles ── */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]">
        <div className="mx-auto max-w-7xl px-5 py-16">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            {/* Column 1: Brand & Bio */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 font-bold">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 to-indigo-700 text-sm font-black text-white shadow-md">
                  FD
                </span>
                <span className="text-lg font-black tracking-tight">FieldDispatch</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-muted)] max-w-sm">
                Enterprise on-demand field asset inspection and verified repair dispatch platform. Built with
                server-authoritative rates, cryptographic OTP verification, and tamper-evident audit trails.
              </p>

              {/* Social Media Handles */}
              <div className="mt-6">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text)] mb-3">
                  Connect With Us
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="https://x.com/FieldDispatchHQ"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] hover:text-black dark:hover:text-white hover:border-[var(--color-primary)] transition-colors"
                    aria-label="X (Twitter)"
                  >
                    <TwitterIcon className="h-4 w-4" />
                  </a>
                  <a
                    href="https://linkedin.com/company/fielddispatch"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] hover:text-[#0A66C2] hover:border-[var(--color-primary)] transition-colors"
                    aria-label="LinkedIn"
                  >
                    <LinkedInIcon className="h-4 w-4" />
                  </a>
                  <a
                    href="https://github.com/fielddispatch"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] hover:text-black dark:hover:text-white hover:border-[var(--color-primary)] transition-colors"
                    aria-label="GitHub"
                  >
                    <GitHubIcon className="h-4 w-4" />
                  </a>
                  <a
                    href="https://youtube.com/@FieldDispatchOps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] hover:text-[#FF0000] hover:border-[var(--color-primary)] transition-colors"
                    aria-label="YouTube"
                  >
                    <YouTubeIcon className="h-4 w-4" />
                  </a>
                  <a
                    href="https://instagram.com/fielddispatch.official"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] hover:text-[#E4405F] hover:border-[var(--color-primary)] transition-colors"
                    aria-label="Instagram"
                  >
                    <InstagramIcon className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>

            {/* Column 2: Services */}
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text)]">
                Field Services
              </p>
              <div className="flex flex-col gap-2.5 text-xs text-[var(--color-text-muted)]">
                <a href="#services" className="hover:text-[var(--color-primary)]">
                  Electrical Inspection
                </a>
                <a href="#services" className="hover:text-[var(--color-primary)]">
                  Mechanical Diagnostics
                </a>
                <a href="#services" className="hover:text-[var(--color-primary)]">
                  Commercial HVAC
                </a>
                <a href="#services" className="hover:text-[var(--color-primary)]">
                  Solar PV Arrays
                </a>
                <a href="#map-preview" className="hover:text-[var(--color-primary)]">
                  Live Coverage Map
                </a>
              </div>
            </div>

            {/* Column 3: Portals */}
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text)]">
                Portals
              </p>
              <div className="flex flex-col gap-2.5 text-xs text-[var(--color-text-muted)]">
                <Link href="/app" className="hover:text-[var(--color-primary)]">
                  Client Portal
                </Link>
                <Link href="/tech" className="hover:text-[var(--color-primary)]">
                  Technician Portal
                </Link>
                <Link href="/admin" className="hover:text-[var(--color-primary)]">
                  Admin Dispatch Console
                </Link>
                <Link href="/login" className="hover:text-[var(--color-primary)]">
                  Demo Account Logins
                </Link>
                <Link href="/register" className="hover:text-[var(--color-primary)]">
                  Register New Account
                </Link>
              </div>
            </div>

            {/* Column 4: Contact & Verification */}
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text)]">
                Operations Headquarters
              </p>
              <div className="flex flex-col gap-2.5 text-xs text-[var(--color-text-muted)]">
                <a
                  href="mailto:dispatch@fielddispatch.in"
                  className="flex items-center gap-1.5 hover:text-[var(--color-primary)]"
                >
                  <Mail size={13} /> dispatch@fielddispatch.in
                </a>
                <a
                  href="tel:+918001234567"
                  className="flex items-center gap-1.5 hover:text-[var(--color-primary)]"
                >
                  <Phone size={13} /> +91 800 123 4567
                </a>
                <span className="flex items-start gap-1.5 text-[var(--color-text-muted)]">
                  <MapPin size={13} className="shrink-0 mt-0.5" /> Koramangala Hub, Bengaluru, Karnataka
                </span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> 24/7 Dispatch Desk
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-border)] pt-6 text-xs text-[var(--color-text-muted)]">
            <p>© {new Date().getFullYear()} FieldDispatch Technologies Inc. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <ShieldCheck size={13} className="text-blue-600 dark:text-blue-400" /> ISO 9001:2015 & IEC
                Certified
              </span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
