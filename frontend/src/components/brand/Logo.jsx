import { Link } from "react-router-dom";
import fullLogo from "../../assets/logo/logo-full-dark.png";
import markLogo from "../../assets/logo2.png";

const logoAssets = {
  full: fullLogo,
  mark: markLogo,
};

const logoSizes = {
  sm: 32,
  md: 48,
  lg: 72,
};

function Logo({
  variant = "full",
  tone = "dark",
  size = "md",
  to = "/",
  className = "",
}) {
  const height = logoSizes[size] || logoSizes.md;
  const alt = to
    ? `AbsoluteCare Therapy Center, go to ${to === "/" ? "home" : "the dashboard"}`
    : "AbsoluteCare Therapy Center";
  const image = (
    <img
      className={`logo-image logo-image-${variant} logo-image-${tone} ${className}`.trim()}
      src={logoAssets[variant] || logoAssets.full}
      alt={to ? alt : ""}
      aria-hidden={to ? undefined : true}
      width={height}
      height={height}
      loading="eager"
    />
  );

  if (!to) return image;
  return (
    <Link className="logo-link" to={to} aria-label={alt}>
      {image}
    </Link>
  );
}

export default Logo;
