import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // The browser talks to the API only through our same-origin /api/proxy route (cookies stay httpOnly);
  // the socket connects straight to the API with a short-lived token from /api/session/token.
  transpilePackages: ['@dispatch/contracts'],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
