import type { Metadata } from 'next'
import { IBM_Plex_Mono, DM_Sans } from 'next/font/google'
import './globals.css'
import { ChatProvider } from '@/context/ChatContext'
import Sidebar from '@/components/Sidebar'
import EnvWarningBanner from '@/components/EnvWarningBanner'
import { validateEnv } from '@/lib/validateEnv'

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
})

export const metadata: Metadata = {
  title: 'NanoMind',
  description: 'AI research co-pilot for nanoscience and materials chemistry',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { missing, warnings } = validateEnv()

  return (
    <html
      lang="en"
      className={`${ibmPlexMono.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col bg-[#0A0C0F] text-white/87">
        <EnvWarningBanner missing={missing} warnings={warnings} />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <ChatProvider>
            <Sidebar />
            <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
          </ChatProvider>
        </div>
      </body>
    </html>
  )
}
