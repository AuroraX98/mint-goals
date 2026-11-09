import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Mint Goals',
  description: 'Break goals into small steps, keep a note about why they matter, and see your progress in a mint-green glass planner.',
};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
