import { Link } from 'react-router-dom'
import fullLogo from '@/assets/logo/logo-full-dark.png'
import markLogo from '@/assets/logo2.png'

const logoAssets = { full: fullLogo, mark: markLogo }
const logoSizes = { sm: 32, md: 48, lg: 72 }

type LogoProps = {
  variant?: keyof typeof logoAssets
  tone?: string
  size?: keyof typeof logoSizes
  to?: string | null
  className?: string
}

function Logo({
  variant = 'full',
  tone = 'dark',
  size = 'md',
  to = '/',
  className = '',
}: LogoProps) {
  const height = logoSizes[size]
  const alt = to
    ? `AbsoluteCare Therapy Center, go to ${to === '/' ? 'home' : 'the dashboard'}`
    : 'AbsoluteCare Therapy Center'
  const image = (
    <img
      className={`object-contain ${className}`.trim()}
      data-tone={tone}
      src={logoAssets[variant]}
      alt={to ? alt : ''}
      aria-hidden={to ? undefined : true}
      width={height}
      height={height}
      loading={to ? 'eager' : 'lazy'}
      decoding="async"
    />
  )

  if (!to) return image
  return (
    <Link className="inline-flex shrink-0" to={to} aria-label={alt}>
      {image}
    </Link>
  )
}

export default Logo
