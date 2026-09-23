import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'TeleVault', description: 'Private cloud storage powered by your private Telegram channel.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
