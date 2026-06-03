import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Orbit — Stay In Orbit',
  description:
    'An AI-powered workspace ecosystem for projects, teams, quality control, analytics and intelligent operations.',
  keywords: [
    'workspace', 'project management', 'AI', 'quality control',
    'accreditation', 'analytics', 'AI assistant', 'team collaboration',
  ],
  openGraph: {
    title: 'Orbit — Stay In Orbit',
    description: 'The command center for modern teams.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="font-body bg-space-dark text-white antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
