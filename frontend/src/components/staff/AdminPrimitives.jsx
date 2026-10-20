import { MoreHorizontal, Pencil, Eye } from "lucide-react";
import { useState } from "react";

const roleLabels = {
  admin: "Admin",
  therapist: "Therapist",
  secretary: "Secretary",
  user: "Patient",
  patient: "Patient",
};

export function RoleBadge({ role }) {
  const label = roleLabels[role] || "Unknown";
  return (
    <span className={`admin-role-badge role-${role || "unknown"}`}>
      {label}
    </span>
  );
}

export function AccountStatusBadge({ user }) {
  const label = user?.removedAt
    ? "Removed"
    : user?.isArchived
      ? "Archived"
      : user?.isActive
        ? "Active"
        : "Deactivated";
  const variant = label.toLowerCase();
  return (
    <span className={`admin-account-status status-${variant}`}>{label}</span>
  );
}

export function StackedCell({ primary, secondary, className = "" }) {
  return (
    <span className={`admin-stacked-cell ${className}`.trim()}>
      <strong title={primary || "Not added"}>{primary || "Not added"}</strong>
      {secondary && <small title={secondary}>{secondary}</small>}
    </span>
  );
}

export function RowActions({ onView, onEdit, menu = [], self = false }) {
  const [open, setOpen] = useState(false);
  const availableMenu = self
    ? menu.filter(
        (item) => !["deactivate", "archive", "remove"].includes(item.key),
      )
    : menu;
  return (
    <div
      className="admin-row-actions"
      onClick={(event) => event.stopPropagation()}
    >
      {onView && (
        <button type="button" aria-label="View" title="View" onClick={onView}>
          <Eye size={16} />
        </button>
      )}
      {onEdit && (
        <button type="button" aria-label="Edit" title="Edit" onClick={onEdit}>
          <Pencil size={16} />
        </button>
      )}
      {availableMenu.length > 0 && (
        <span className="admin-row-menu-wrap">
          <button
            type="button"
            aria-label="More actions"
            title="More actions"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <MoreHorizontal size={17} />
          </button>
          {open && (
            <div className="admin-row-menu" role="menu">
              {self && <span className="admin-row-menu-you">You</span>}
              {availableMenu.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  className={item.danger ? "is-danger" : ""}
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </span>
      )}
      {self && <span className="admin-you-tag">You</span>}
    </div>
  );
}
