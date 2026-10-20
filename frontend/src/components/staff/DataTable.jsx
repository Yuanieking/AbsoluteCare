export default function DataTable({
  columns = [],
  rows = [],
  rowKey,
  onRowClick,
  empty,
  className = "",
}) {
  return (
    <div className={`staff-data-table-shell ${className}`.trim()}>
      <table className="staff-data-table">
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={column.align === "right" ? "is-right" : ""}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr
                key={rowKey ? rowKey(row) : row._id || index}
                className={onRowClick ? "is-clickable" : ""}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    data-label={column.label}
                    className={column.align === "right" ? "is-right" : ""}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr className="staff-data-table-empty">
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
