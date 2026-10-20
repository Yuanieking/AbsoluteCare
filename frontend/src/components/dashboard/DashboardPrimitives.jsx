import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function StatCard({
  action,
  caption,
  children,
  icon,
  label,
  className,
  value,
  variant = "default",
  href,
}) {
  const content = (
    <>
      <div className="stat-card-header">
        {icon && <span className="stat-card-icon">{icon}</span>}
        <span className="stat-card-label">{label}</span>
      </div>
      <div className="stat-card-value-area">
        <strong className="stat-card-value">{value}</strong>
        {children}
        {caption && <span className="stat-card-caption">{caption}</span>}
      </div>
      {action && (
        <span className="stat-card-footer">
          <span>{action}</span> <ArrowUpRight size={14} aria-hidden="true" />
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        className={cx("stat-card", `stat-card-${variant}`, className)}
        to={href}
      >
        {content}
      </Link>
    );
  }

  return (
    <article className={cx("stat-card", `stat-card-${variant}`, className)}>
      {content}
    </article>
  );
}

export function DashboardCard({
  as: Element = "article",
  className,
  children,
  ...props
}) {
  return (
    <Element className={cx("dashboard-card", className)} {...props}>
      {children}
    </Element>
  );
}

export function Card(props) {
  return <DashboardCard {...props} />;
}

export function Button({ variant = "primary", className = "", ...props }) {
  return (
    <button
      type={props.type || "button"}
      className={`dashboard-${variant === "secondary" ? "secondary" : "primary"}-button ${className}`.trim()}
      {...props}
    />
  );
}

export function StatusBadge({ status }) {
  if (!status) return null;
  const raw = String(status)
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  const labels = {
    pending: "Pending",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    "no-show": "No-show",
  };
  const displayLabel =
    labels[raw] ||
    (typeof status === "string"
      ? status.charAt(0).toUpperCase() + status.slice(1)
      : raw);

  return (
    <span className={cx("dashboard-status-badge", `status-${raw}`)}>
      {displayLabel}
    </span>
  );
}

export function DashboardEmptyState({
  icon,
  title,
  message,
  action,
  className = "",
}) {
  return (
    <div className={cx("dashboard-empty-state", className)}>
      {icon && (
        <span className="dashboard-empty-state-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <h2>{title}</h2>
      {message && <p className="dashboard-empty-state-message">{message}</p>}
      {action && <div className="dashboard-empty-state-action">{action}</div>}
    </div>
  );
}
