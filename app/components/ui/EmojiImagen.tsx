import Image from 'next/image'

// Ilustraciones 3D (Fluent Emoji de Microsoft, licencia MIT) para reemplazar
// los emojis de carrito y billete, que en Windows se ven planos.
const IMAGENES = {
  carrito: '/emojis/carrito.png',
  billete: '/emojis/billete.png',
} as const

interface EmojiImagenProps {
  nombre: keyof typeof IMAGENES
  className?: string // tamaño, ej: "w-6 h-6"
}

export default function EmojiImagen({ nombre, className = 'w-5 h-5' }: EmojiImagenProps) {
  return (
    <Image
      src={IMAGENES[nombre]}
      alt=""
      aria-hidden="true"
      width={64}
      height={64}
      className={`inline-block align-middle flex-shrink-0 object-contain ${className}`}
    />
  )
}
