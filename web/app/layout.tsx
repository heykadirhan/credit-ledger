import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Credit ledger',
  description: 'Buy credits, spend them on jobs, and watch the ledger stay consistent.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
