import { Filter, Plus, Search } from "lucide-react";
import StaffEmptyTable from "./StaffEmptyTable";
import StaffPageHeader from "./StaffPageHeader";

function StaffTablePage({
  eyebrow = "Workspace",
  title,
  description,
  columns,
  emptyMessage,
  action,
  filter = false,
  search = false,
}) {
  return (
    <main className="staff-dashboard-content">
      <section className="staff-dashboard-section staff-standalone-page">
        <StaffPageHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          action={
            <div className="staff-section-actions">
              {filter && (
                <button type="button">
                  <Filter size={14} />
                  Filter
                </button>
              )}
              {search && (
                <button type="button" aria-label={`Search ${title}`}>
                  <Search size={16} />
                </button>
              )}
              {action && (
                <button className="staff-section-primary" type="button">
                  <Plus size={14} />
                  {action}
                </button>
              )}
            </div>
          }
        />
        <StaffEmptyTable columns={columns} message={emptyMessage} />
      </section>
    </main>
  );
}

export default StaffTablePage;
