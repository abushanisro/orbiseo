import type { Metadata } from 'next';
import './globals.css';
import { AppLayout } from '@/components/layout/app-layout';
import { Toaster } from '@/components/ui/toaster';
import { Analytics } from '@vercel/analytics/react';
import { FirebaseProvider } from '@/firebase';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  title: 'OrbiSEO',
  description: 'See the meaning behind search. AI-powered semantic SEO platform for crypto marketers. Analyze entities, intent, and meaning — just like Google\'s algorithms do.',
  keywords: 'semantic SEO, crypto SEO, blockchain SEO, Web3 marketing, AI SEO, entity extraction, search intent, topical authority',
  authors: [{ name: 'OrbiSEO Team' }],
  creator: 'OrbiSEO',
  publisher: 'OrbiSEO',
  openGraph: {
    title: 'OrbiSEO',
    description: 'See the meaning behind search. AI-powered semantic SEO platform for crypto marketers.',
    url: 'https://orbiseo.com',
    siteName: 'OrbiSEO',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OrbiSEO',
    description: 'See the meaning behind search. AI-powered semantic SEO platform for crypto marketers.',
    creator: '@OrbiSEO',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/safari-pinned-tab.svg',
        color: '#1a1a1a',
      },
    ],
  },
  manifest: '/site.webmanifest',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a1a' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" />
        <link rel="icon" href="/favicon-48x48.png" type="image/png" sizes="48x48" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="icon" href="/android-chrome-192x192.png" type="image/png" sizes="192x192" />
        <link rel="icon" href="/android-chrome-512x512.png" type="image/png" sizes="512x512" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <meta name="msapplication-TileColor" content="#1a1a1a" />
        <meta name="theme-color" content="#1a1a1a" />
        {process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && (
          <script
            src={`https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`}
            async
            defer
          />
        )}
      </head>
      <body className="font-body antialiased bg-background text-foreground">
        <FirebaseProvider>
          <div className="min-h-screen flex flex-col">
            <AppLayout>{children}</AppLayout>
            <Footer />
          </div>
          <Toaster />
          <Analytics />
        </FirebaseProvider>
      </body>
    </html>
  );
}