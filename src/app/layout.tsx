import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import '../styles/global.css';

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400'],
  variable: '--next-display',
});

const ui = Inter({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--next-ui',
});

export const metadata: Metadata = {
  title: 'Nobu Residences 619 Brickell · Views',
  description: 'Explore the real view from every floor of Nobu Residences 619 Brickell, captured by drone.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0B0B0C',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body>{children}</body>
    </html>
  );
}
