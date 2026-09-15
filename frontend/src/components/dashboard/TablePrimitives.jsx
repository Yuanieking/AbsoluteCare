import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export function TableActionLink({
  to,
  onClick,
  children = 'View details',
  className = '',
  icon = true,
  ...props
}) {
  const content = (
    <>
      <span>{children}</span>
      {icon && <ChevronRight size={14} aria-hidden="true" />}
    </>
  )

  const handleClick = (e) => {
    e.stopPropagation()
    if (onClick) onClick(e)
  }

  if (to) {
    return (
      <Link
        to={to}
        onClick={handleClick}
        className={`shared-table-action-link ${className}`.trim()}
        {...props}
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`shared-table-action-link ${className}`.trim()}
      {...props}
    >
      {content}
    </button>
  )
}

export function EmptyCellValue({ children = 'None scheduled' }) {
  return <span className="shared-empty-cell-value">{children}</span>
}

export function TruncatedText({ text, maxWidth = '220px', className = '' }) {
  if (!text) return null
  return (
    <span
      className={`shared-truncated-text ${className}`.trim()}
      style={{ maxWidth }}
      title={text}
    >
      {text}
    </span>
  )
}

export function PatientCell({
  name,
  subtitle,
  avatarUrl,
  initials,
  isDependent = false,
  guardianName,
}) {
  const computedInitials =
    initials ||
    name
      ?.split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() ||
    '?'

  return (
    <div className="shared-patient-cell">
      <div className="shared-patient-avatar" aria-hidden="true">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="shared-patient-avatar-img" />
        ) : (
          <span className="shared-patient-avatar-fallback">
            {computedInitials}
          </span>
        )}
      </div>
      <div className="shared-patient-info">
        <strong className="shared-patient-name" title={name}>
          {name}
        </strong>
        {isDependent && guardianName ? (
          <span
            className="shared-patient-sub shared-patient-guardian"
            title={`Guardian: ${guardianName}`}
          >
            Guardian: {guardianName}
          </span>
        ) : subtitle ? (
          <span className="shared-patient-sub" title={subtitle}>
            {subtitle}
          </span>
        ) : null}
      </div>
    </div>
  )
}
