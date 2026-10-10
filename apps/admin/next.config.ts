import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // The browser talks to the API only through our same-origin /api/proxy route (cookies stay httpOnly);
  // the socket connects straight to the API with a short-lived token from /api/session/token.
  transpilePackages: ['@dispatch/contracts', '@dispatch/ui-tokens'],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  // Deep links and aliases for customer, technician and admin specs
  async redirects() {
    return [
      { source: '/dashboard', destination: '/admin', permanent: false },
      { source: '/live', destination: '/admin/live', permanent: false },
      { source: '/technicians', destination: '/admin/technicians', permanent: false },
      { source: '/audit', destination: '/admin/audit', permanent: false },
      { source: '/jobs', destination: '/admin/live', permanent: false },
      { source: '/jobs/:id', destination: '/admin/jobs/:id', permanent: false },
      { source: '/dev/components', destination: '/admin/dev/components', permanent: false },

      // Customer specification aliases
      { source: '/customer', destination: '/app', permanent: false },
      { source: '/customer/dashboard', destination: '/app', permanent: false },
      { source: '/customer/bookings/new', destination: '/app/new', permanent: false },
      {
        source: '/customer/bookings/:id/technicians',
        destination: '/app/requests/:id/technicians',
        permanent: false,
      },
      { source: '/customer/bookings/:id/confirm', destination: '/app/requests/:id', permanent: false },
      { source: '/customer/requests', destination: '/app', permanent: false },
      { source: '/customer/requests/:id', destination: '/app/requests/:id', permanent: false },
      { source: '/customer/requests/:id/arrival', destination: '/app/requests/:id', permanent: false },
      { source: '/customer/requests/:id/review', destination: '/app/requests/:id', permanent: false },
      { source: '/customer/history', destination: '/app/history', permanent: false },
      { source: '/customer/history/:id', destination: '/app/requests/:id/receipt', permanent: false },
      { source: '/customer/profile', destination: '/app/profile', permanent: false },

      // Technician specification aliases
      { source: '/technician', destination: '/tech', permanent: false },
      { source: '/technician/dashboard', destination: '/tech', permanent: false },
      { source: '/technician/jobs', destination: '/tech', permanent: false },
      { source: '/technician/jobs/:id', destination: '/tech/jobs/:id', permanent: false },
      { source: '/technician/jobs/:id/arrival', destination: '/tech/jobs/:id', permanent: false },
      { source: '/technician/jobs/:id/work', destination: '/tech/jobs/:id', permanent: false },
      { source: '/technician/jobs/:id/evidence', destination: '/tech/jobs/:id', permanent: false },
      { source: '/technician/rework', destination: '/tech', permanent: false },
      { source: '/technician/history', destination: '/tech', permanent: false },
      { source: '/technician/profile', destination: '/tech/profile', permanent: false },

      // Admin specification aliases
      { source: '/admin/dashboard', destination: '/admin', permanent: false },
      { source: '/admin/jobs/map', destination: '/admin/live', permanent: false },
      { source: '/admin/exceptions', destination: '/admin', permanent: false },
      { source: '/admin/settings', destination: '/admin', permanent: false },
    ];
  },
};

export default nextConfig;
