import type { Metadata } from 'next';
export const metadata: Metadata = {title:'Mint Goals',description:'A little structure. A lot of possibility.'};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
