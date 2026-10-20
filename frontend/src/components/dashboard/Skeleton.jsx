import LoadingSkeleton from '../loading/Skeleton'
import AppLoader from '../loading/AppLoader'

const Skeleton = LoadingSkeleton

export function StatCardSkeleton() {
  return (
    <article className="stat-card stat-card-skeleton" aria-hidden="true">
      <div className="stat-card-header">
        <Skeleton variant="rectangle" width="34px" height="34px" radius="7px" />
        <Skeleton variant="text" width="46%" height="12px" />
      </div>
      <div className="stat-card-value-area">
        <Skeleton variant="heading" width="60%" height="36px" />
        <Skeleton variant="text" width="70%" height="13px" />
      </div>
      <Skeleton variant="text" width="38%" height="12px" />
    </article>
  )
}

export function InlineErrorCard({ message = 'Unable to load data.', onRetry }) {
  return (
    <div className="dashboard-card inline-error-card" role="alert">
      <div className="inline-error-content">
        <strong className="inline-error-title">Something went wrong</strong>
        <p className="inline-error-text">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="dashboard-secondary-button inline-error-retry"
        >
          Try again
        </button>
      )}
    </div>
  )
}

export function StaffDashboardSkeleton() {
  return (
    <main
      className="staff-dashboard-content dashboard-loading-region"
      aria-busy="true"
    >
      <p className="sr-only" role="status">
        Loading therapist workspace
      </p>
      <header className="page-header" aria-hidden="true">
        <div className="page-header-copy">
          <Skeleton variant="text" width="130px" height="12px" />
          <Skeleton variant="heading" width="320px" height="40px" />
          <Skeleton variant="text" width="260px" height="15px" />
        </div>
      </header>
      <section className="summary-grid" aria-hidden="true">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </section>
      <section className="dashboard-card staff-schedule-card" aria-hidden="true">
        <div className="staff-schedule-header">
          <div>
            <Skeleton variant="text" width="100px" height="12px" />
            <Skeleton variant="heading" width="180px" height="24px" />
            <Skeleton variant="text" width="220px" height="14px" />
          </div>
          <Skeleton variant="text" width="80px" height="14px" />
        </div>
        <div className="staff-schedule-list">
          {[1, 2, 3].map((row) => (
            <div className="therapist-schedule-row-skeleton" key={row}>
              <Skeleton variant="rectangle" width="70px" height="20px" />
              <div style={{ flex: 1 }}>
                <Skeleton variant="text" width="160px" height="16px" />
                <Skeleton variant="text" width="110px" height="12px" />
              </div>
              <Skeleton variant="rectangle" width="80px" height="24px" radius="999px" />
              <Skeleton variant="button" width="70px" height="32px" />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

export function StaffTableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="staff-table-shell" aria-hidden="true">
      <table className="staff-table">
        <thead>
          <tr>
            {Array.from({ length: columns }, (_, idx) => (
              <th key={idx}>
                <Skeleton variant="text" width="60%" height="12px" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, rowIdx) => (
            <tr key={rowIdx}>
              {Array.from({ length: columns }, (_, colIdx) => (
                <td key={colIdx}>
                  <Skeleton
                    variant="text"
                    width={colIdx === 0 ? '75%' : colIdx === columns - 1 ? '50%' : '60%'}
                    height="14px"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <main
      className="dashboard-content dashboard-loading-region"
      aria-busy="true"
    >
      <p className="sr-only" role="status">
        Loading your dashboard
      </p>
      <section
        className="dashboard-welcome dashboard-welcome-skeleton"
        aria-hidden="true"
      >
        <div>
          <Skeleton variant="text" width="145px" height="10px" />
          <Skeleton variant="heading" width="310px" height="45px" />
          <Skeleton variant="text" width="220px" height="12px" />
        </div>
        <Skeleton variant="button" width="160px" height="44px" />
      </section>
      <section className="summary-grid" aria-hidden="true">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </section>
      <Skeleton
        className="dashboard-skeleton-banner"
        variant="rectangle"
        width="100%"
        height="55px"
      />
      <section
        className="dashboard-section dashboard-history-skeleton"
        aria-hidden="true"
      >
        <div className="section-title-row">
          <div>
            <Skeleton variant="text" width="120px" height="10px" />
            <Skeleton variant="heading" width="190px" height="29px" />
          </div>
          <Skeleton variant="rectangle" width="32px" height="32px" />
        </div>
        {[1, 2, 3].map((row) => (
          <div className="history-skeleton-row" key={row}>
            <Skeleton variant="circle" width="29px" height="29px" />
            <span>
              <Skeleton variant="text" width="130px" height="11px" />
              <Skeleton variant="text" width="210px" height="10px" />
            </span>
          </div>
        ))}
      </section>
    </main>
  )
}

export { AppLoader }
export default LoadingSkeleton

