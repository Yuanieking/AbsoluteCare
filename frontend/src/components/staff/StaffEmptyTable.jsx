import { ClipboardList } from 'lucide-react'
import { DashboardEmptyState } from '../dashboard/DashboardPrimitives'

function StaffEmptyTable({ columns, message, action, caption = 'Connected records will appear here when they are available.' }) {
  return (
    <div className="staff-table-shell">
      <table className="staff-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={columns.length}>
              <DashboardEmptyState
                icon={<ClipboardList size={22} />}
                title={message}
                message={caption}
                action={action}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default StaffEmptyTable

