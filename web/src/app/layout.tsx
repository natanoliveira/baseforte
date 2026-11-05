import './globals.css';
import type { Metadata } from 'next';
import { IBM_Plex_Mono, Instrument_Sans, Young_Serif } from 'next/font/google';

const display = Young_Serif({ subsets: ['latin'], weight: '400', variable: '--font-display' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' });

export const metadata: Metadata = { title: 'BaseForte', description: 'Gestão de lideranças e campanha' };

const THEME_INIT = `try{var t=localStorage.getItem('bf-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_INIT }} /></head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
