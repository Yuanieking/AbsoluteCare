import { cloneElement, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink } from "react-router-dom";
import { ChevronLeft, ChevronRight, Headset, Menu, X } from "lucide-react";
import { getSidebarConfig } from "../../config/sidebarConfig";
import { useSidebar } from "../../context/useSidebar";
import Logo from "../brand/Logo";

function Sidebar({ role, badgeCounts }) {
  const { collapsed, toggleCollapsed, isMobile } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);
  const config = role ? getSidebarConfig(role, badgeCounts) : null;
  const groupedItems = useMemo(() => {
    if (!config) return {};
    return config.items.reduce((groups, item) => {
      const group = item.group || config.navLabel || "Workspace";
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
      return groups;
    }, {});
  }, [config]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!config) return <SidebarSkeleton />;

  const dashboardPath =
    config.items.find((item) => item.key === "dashboard")?.to || "/";
  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <>
      {mobileOpen && (
        <button
          className="dashboard-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={closeMobile}
        />
      )}
      {isMobile && (
        <div className="dashboard-mobile-brand">
          <button
            className="dashboard-mobile-menu"
            type="button"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={21} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <Logo variant="mark" tone="dark" size="sm" to={dashboardPath} />
        </div>
      )}
      <aside
        className={`dashboard-sidebar${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-open" : ""}`}
        aria-label={`${config.label} navigation`}
      >
        <div className="dashboard-sidebar-head">
          <Link
            className="dashboard-brand"
            to={dashboardPath}
            onClick={closeMobile}
          >
            <Logo
              className="dashboard-brand-logo"
              variant="mark"
              tone="dark"
              size="md"
              to={null}
            />
            <span className="dashboard-brand-copy">{config.subtitle}</span>
          </Link>
          <button
            className="dashboard-sidebar-toggle"
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            onClick={toggleCollapsed}
          >
            {collapsed ? <ChevronRight size={19} /> : <ChevronLeft size={19} />}
          </button>
          <button
            className="dashboard-sidebar-close"
            type="button"
            aria-label="Close navigation"
            onClick={closeMobile}
          >
            <X size={19} />
          </button>
        </div>

        <nav className="dashboard-nav" aria-label="Main">
          <div className="dashboard-nav-scroll">
            {Object.entries(groupedItems).map(([group, items]) => (
              <div className="dashboard-nav-group" key={group}>
                <p className="dashboard-nav-label">{group}</p>
                <div className="dashboard-nav-list">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const label = `${item.label}${item.badge ? ` (${item.badge > 99 ? "99+" : item.badge})` : ""}`;
                    return (
                      <SidebarTooltip
                        key={item.key}
                        label={label}
                        enabled={collapsed}
                      >
                        <NavLink
                          className={({ isActive }) =>
                            `dashboard-nav-link${isActive ? " is-active" : ""}`
                          }
                          end={item.end}
                          aria-label={collapsed ? label : undefined}
                          to={item.to}
                          onClick={closeMobile}
                        >
                          <Icon
                            size={22}
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                          <span className="dashboard-nav-link-label">
                            {item.label}
                          </span>
                          {item.badge ? (
                            <span
                              className="dashboard-nav-badge"
                              aria-label={`${item.badge} pending`}
                            >
                              {item.badge > 99 ? "99+" : item.badge}
                            </span>
                          ) : null}
                        </NavLink>
                      </SidebarTooltip>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="dashboard-sidebar-footer">
          {collapsed ? (
            <SidebarTooltip
              label={`${config.helpTitle} ${config.helpText}`}
              enabled
            >
              <a
                className="dashboard-help dashboard-help-tile"
                href={
                  role === "patient"
                    ? "tel:09177152780"
                    : "mailto:clinic@absolutecare.com"
                }
                aria-label={`${config.helpTitle} ${config.helpText}`}
              >
                <Headset size={22} aria-hidden="true" />
              </a>
            </SidebarTooltip>
          ) : (
            <div className="dashboard-help">
              <span className="dashboard-help-icon" aria-hidden="true">
                <Headset size={18} />
              </span>
              <span className="dashboard-help-copy">
                <strong>{config.helpTitle}</strong>
                <span>{config.helpText}</span>
              </span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function SidebarTooltip({ children, enabled, label }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);

  function showTooltip(event) {
    if (!enabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect)
      setPosition({ top: rect.top + rect.height / 2, left: rect.right + 12 });
    setOpen(true);
  }

  function hideTooltip() {
    setOpen(false);
    setPosition(null);
  }

  const child = cloneElement(children, {
    onMouseEnter: showTooltip,
    onMouseLeave: hideTooltip,
    onFocus: showTooltip,
    onBlur: hideTooltip,
  });
  return (
    <>
      {child}
      {enabled && open && position && typeof document !== "undefined"
        ? createPortal(
            <span
              className="dashboard-sidebar-tooltip"
              style={{ top: position.top, left: position.left }}
              role="tooltip"
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

function SidebarSkeleton() {
  return (
    <aside
      className="dashboard-sidebar dashboard-sidebar-skeleton"
      aria-hidden="true"
    >
      <div className="dashboard-sidebar-head">
        <span className="sidebar-skeleton-logo" />
        <span className="sidebar-skeleton-toggle" />
      </div>
      <div className="sidebar-skeleton-nav">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="sidebar-skeleton-help" />
    </aside>
  );
}

export default Sidebar;
