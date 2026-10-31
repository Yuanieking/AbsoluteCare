import { CalendarDays, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function today() {
  return new Date().toISOString().slice(0, 10);
}
function weekStart() {
  const date = new Date();
  date.setDate(date.getDate() - date.getDay());
  return date.toISOString().slice(0, 10);
}
function monthStart() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

export default function DateRangeControl({ from = "", to = "", onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function close(event) {
      if (!ref.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const label =
    from || to ? `${from || "Start"} – ${to || "End"}` : "Date range";
  function preset(value) {
    const end = today();
    onChange(
      value === "today"
        ? { from: end, to: end }
        : { from: value === "week" ? weekStart() : monthStart(), to: end },
    );
    setOpen(false);
  }
  return (
    <div className="date-range-control" ref={ref}>
      <button
        type="button"
        className={from || to ? "is-active" : ""}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <CalendarDays size={16} />
        {label}
        {(from || to) && (
          <X
            size={14}
            aria-label="Clear date range"
            onClick={(event) => {
              event.stopPropagation();
              onChange({ from: "", to: "" });
            }}
          />
        )}
      </button>
      {open && (
        <div className="date-range-popover">
          <div className="date-range-presets">
            <button type="button" onClick={() => preset("today")}>
              Today
            </button>
            <button type="button" onClick={() => preset("week")}>
              This week
            </button>
            <button type="button" onClick={() => preset("month")}>
              This month
            </button>
          </div>
          <label>
            From
            <input
              type="date"
              value={from}
              onChange={(event) => onChange({ from: event.target.value, to })}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={to}
              onChange={(event) => onChange({ from, to: event.target.value })}
            />
          </label>
          <button
            type="button"
            className="date-range-apply"
            onClick={() => setOpen(false)}
          >
            Apply range
          </button>
        </div>
      )}
    </div>
  );
}
