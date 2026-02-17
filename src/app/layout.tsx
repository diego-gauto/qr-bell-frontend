import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: 'QR Bell',
    template: '%s | QR Bell'
  },
  description: 'QR Bell smart doorbell PWA',
  manifest: '/manifest.json'
};

export const viewport: Viewport = {
  themeColor: '#2563eb'
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
