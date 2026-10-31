import { Search, X } from "lucide-react";

export default function FilterBar({
  tabs = [],
  activeTab,
  onTabChange,
  search,
  onSearch,
  searchPlaceholder = "Search",
  children,
  chips = [],
  onClear,
}) {
  return (
    <div className="shared-filter-bar">
      {tabs.length > 0 && (
        <div
          className="shared-filter-tabs"
          role="tablist"
          aria-label="Filter views"
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={activeTab === tab.key ? "is-active" : ""}
              onClick={() => onTabChange?.(tab.key)}
            >
              {tab.label}
              {tab.count !== undefined && <span>{tab.count}</span>}
            </button>
          ))}
        </div>
      )}
      {onSearch && (
        <label className="shared-filter-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search</span>
          <input
            value={search || ""}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={searchPlaceholder}
          />
        </label>
      )}
      {children}
      {chips.length > 0 && (
        <div className="shared-filter-chips">
          {chips.map((chip) => (
            <button
              key={chip.key || chip.label}
              type="button"
              onClick={chip.onRemove}
            >
              {chip.label}
              <X size={13} />
            </button>
          ))}
          <button type="button" onClick={onClear}>
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
