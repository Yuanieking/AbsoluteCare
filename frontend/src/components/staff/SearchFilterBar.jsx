import { Search, X } from "lucide-react";

export default function SearchFilterBar({
  search,
  onSearch,
  status,
  onStatus,
  statuses = [],
  chips = [],
  onClear,
}) {
  return (
    <div className="user-management-toolbar">
      <label className="user-search">
        <Search size={16} />
        <span className="sr-only">Search records</span>
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search name, email, phone, or specialization"
        />
      </label>
      {statuses.length > 0 && (
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(event) => onStatus(event.target.value)}
        >
          <option value="all">All statuses</option>
          {statuses.map((item) => (
            <option value={item.value} key={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      )}
      {chips.length > 0 && (
        <div className="filter-chip-list">
          {chips.map((chip) => (
            <button type="button" key={chip.label} onClick={chip.onRemove}>
              {chip.label}
              <X size={13} />
            </button>
          ))}
          <button type="button" onClick={onClear}>
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
