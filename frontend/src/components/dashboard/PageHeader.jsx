function PageHeader({
  eyebrow,
  title,
  description,
  action,
  meta,
  children,
  className = '',
}) {
  return (
    <header className={`page-header ${className}`.trim()}>
      <div className="page-header-copy">
        {eyebrow && <p className="dashboard-eyebrow">{eyebrow}</p>}
        <div className="page-header-title-row">
          <h1>{title}</h1>
          {children}
        </div>
        {description && <p className="page-header-subtitle">{description}</p>}
        {meta}
      </div>
      {action && <div className="page-header-actions">{action}</div>}
    </header>
  )
}

export default PageHeader

