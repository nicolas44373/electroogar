import './globals.css'
import { Inter } from 'next/font/google'
import { AuthProvider } from './components/AuthProvider'
import NavigationBar from './components/NavigationBar'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata = {
  title: 'Electrohogar · Cobranzas',
  description: 'Gestión de clientes, ventas, préstamos y cobranzas',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0F4C81' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1120' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body>
        <AuthProvider>
          <NavigationBar />
          <main>
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  )
}
