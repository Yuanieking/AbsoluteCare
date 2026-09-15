function Skeleton({ className = "", variant = "text", width, height, radius }) {
  const classes =
    `loading-skeleton loading-skeleton-${variant} ${className}`.trim();
  return (
    <span
      className={classes}
      aria-hidden="true"
      style={{ width, height, borderRadius: radius }}
    />
  );
}

export function ButtonSpinner() {
  return <span className="loading-button-spinner" aria-hidden="true" />;
}

export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="loading-table-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, row) => (
        <div className="loading-table-row" key={row}>
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton
              key={column}
              variant="text"
              width={column === 0 ? "24%" : "16%"}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }) {
  return (
    <div className="loading-card-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <article className="loading-card-skeleton" key={index}>
          <Skeleton variant="circle" width="38px" height="38px" />
          <Skeleton variant="heading" width="62%" height="24px" />
          <Skeleton variant="text" width="82%" />
          <Skeleton variant="text" width="48%" />
        </article>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="loading-chart-skeleton" aria-hidden="true">
      <Skeleton variant="heading" width="32%" height="24px" />
      <Skeleton variant="rectangle" width="100%" height="190px" radius="12px" />
    </div>
  );
}

export default Skeleton;
