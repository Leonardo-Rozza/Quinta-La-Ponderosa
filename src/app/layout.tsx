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
  weight: ['300', '400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-source-sans',
  display: 'swap',
});

export const metadata: Metadata = {
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
  openGraph: {
    title: 'La Ponderosa | Quinta en Alquiler',
    description: 'Tu refugio en la naturaleza, pileta, quincho. Hasta 30 personas.',
    images: ['/og-image.jpg'],
    locale: 'es_AR',
    type: 'website',
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
        {children}
      </body>
    </html>
  );
}
