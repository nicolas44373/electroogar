import './globals.css'
import { AuthProvider } from './components/AuthProvider'
import NavigationBar from './components/NavigationBar'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
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