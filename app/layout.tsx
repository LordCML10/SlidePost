import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import Nav from '@/components/Nav'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'SlidePost',
  description: 'Post photo slideshows to TikTok',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased bg-gray-950 text-white`}>
        <ClerkProvider afterSignOutUrl="/sign-in">
          <Nav />
          <main className="pt-14">{children}</main>
        </ClerkProvider>
      </body>
    </html>
  )
}
