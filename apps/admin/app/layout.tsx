import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Field Dispatch — Enterprise Field Service Engine', template: '%s · Field Dispatch' },
  description:
    'On-demand field asset inspection and verified repair dispatch platform with PostGIS spatial matching and arrival OTP verification.',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  colorScheme: 'light dark',
};

/** Runs before first paint so a stored dark preference never flashes light. Default is light. */
const THEME_INIT = `try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-ink">{children}</body>
    </html>
  );
}
