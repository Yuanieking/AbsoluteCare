import Skeleton, { CardGridSkeleton, TableSkeleton } from "./Skeleton";

export function PageSkeleton({ variant = "table", title = true }) {
  return (
    <main className="dashboard-content loading-page" aria-busy="true">
      <div className="loading-page-header" aria-hidden="true">
        {title && (
          <>
            <Skeleton variant="text" width="110px" height="10px" />
            <Skeleton variant="heading" width="240px" height="30px" />
          </>
        )}
        <Skeleton variant="button" width="132px" height="40px" />
      </div>
      {variant === "cards" ? <CardGridSkeleton /> : <TableSkeleton />}
    </main>
  );
}

export function StaffPageSkeleton({ variant = "table" }) {
  return (
    <main className="staff-dashboard-content loading-page" aria-busy="true">
      <div className="loading-page-header" aria-hidden="true">
        <Skeleton variant="text" width="120px" height="10px" />
        <Skeleton variant="heading" width="280px" height="30px" />
        <Skeleton variant="button" width="140px" height="40px" />
      </div>
      {variant === "cards" ? (
        <CardGridSkeleton count={3} />
      ) : (
        <TableSkeleton rows={6} columns={5} />
      )}
    </main>
  );
}

export default PageSkeleton;
