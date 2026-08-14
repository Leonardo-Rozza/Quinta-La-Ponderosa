import type { Metadata } from 'next';
import { DM_Serif_Display, Source_Sans_3 } from 'next/font/google';
import './globals.css';

const dmSerifDisplay = DM_Serif_Display({
  weight: ['400'],
  subsets: ['latin'],
  variable: '--font-dm-serif', // Esta variable se usa en @theme de globals.css
  display: 'swap',
});

const sourceSans = Source_Sans_3({
  weight: 'variable',
  subsets: ['latin'],
  variable: '--font-source-sans',
  display: 'swap',
});

const siteUrl =
  process.env.SITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'La Ponderosa | Quinta en Alquiler - José C. Paz, Buenos Aires',
  description:
    'Alquilá La Ponderosa por día, pileta, quincho equipado. Hasta 30 personas. Ideal para eventos, cumpleaños y reuniones familiares.',
  keywords: [
    'quinta alquiler',
    'quinta josé c paz',
    'alquiler por día',
    'quinta con pileta',
    'eventos',
    'cumpleaños',
  ],
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
    other: [
      {
        rel: 'android-chrome-192x192',
        url: '/android-chrome-192x192.png',
      },
      {
        rel: 'android-chrome-512x512',
        url: '/android-chrome-512x512.png',
      },
    ],
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'La Ponderosa | Quinta en Alquiler',
    description: 'Tu refugio en la naturaleza, pileta, quincho. Hasta 30 personas.',
    images: ['/og-image.jpg'],
    locale: 'es_AR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'La Ponderosa | Quinta en alquiler',
    description: 'Una jornada al aire libre, con pileta y quincho equipado en José C. Paz.',
    images: ['/og-image.jpg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${dmSerifDisplay.variable} ${sourceSans.variable}`}>
      <body className="font-sans bg-crema text-negro antialiased overflow-x-hidden">
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
