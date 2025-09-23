import './globals.css'
import Link from 'next/link'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <nav className="bg-gray-800 text-white p-4">
          <div className="container mx-auto flex gap-6">
            <Link href="/" className="hover:text-gray-300">Inicio</Link>
            <Link href="/productos" className="hover:text-gray-300">Productos</Link>
            <Link href="/clientes" className="hover:text-gray-300">Clientes</Link>
            <Link href="/cobranzas" className="hover:text-gray-300">Cobranzas</Link>
          </div>
        </nav>
        <main className="container mx-auto p-4">
          {children}
        </main>
      </body>
    </html>
  )
}