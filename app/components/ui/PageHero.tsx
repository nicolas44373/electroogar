import type { ReactNode } from 'react'

interface PageHeroProps {
  emoji: string
  titulo: string
  subtitulo?: ReactNode
  children?: ReactNode // acciones (botones) a la derecha
}

// Encabezado de página con degradé y emoji
export default function PageHero({ emoji, titulo, subtitulo, children }: PageHeroProps) {
  return (
    <header className="hero animate-aparecer">
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <span className="emoji-tile emoji" aria-hidden="true">{emoji}</span>
          <div className="min-w-0">
            <h1 className="hero-title">{titulo}</h1>
            {subtitulo && <p className="hero-subtitle">{subtitulo}</p>}
          </div>
        </div>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </div>
    </header>
  )
}
