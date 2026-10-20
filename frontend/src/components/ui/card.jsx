export function Card({ className = "", children }) {
  return (
    <article className={`admin-chart-card ${className}`.trim()}>
      {children}
    </article>
  );
}

export function CardHeader({ children }) {
  return <header className="admin-chart-card-header">{children}</header>;
}

export function CardTitle({ children }) {
  return <h2 className="admin-chart-card-title">{children}</h2>;
}

export function CardDescription({ children }) {
  return <p className="admin-chart-card-description">{children}</p>;
}

export function CardContent({ children }) {
  return <div className="admin-chart-card-content">{children}</div>;
}
