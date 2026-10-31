import {
  CalendarDays,
  CircleDollarSign,
  Clock3,
  UsersRound,
} from "lucide-react";
import { StatCard } from "../dashboard/DashboardPrimitives";

const summaryIcons = [UsersRound, CalendarDays, Clock3, CircleDollarSign];

function StaffSummaryGrid({ summaries }) {
  return (
    <section
      className={`staff-summary-grid summary-count-${summaries.length}`}
      aria-label="Staff dashboard summary"
    >
      {summaries.map(([label, value, reference], index) => {
        const Icon = summaryIcons[index % summaryIcons.length];
        return (
          <StatCard
            action="View details"
            caption={`Requirement ${reference}`}
            className="staff-summary-card"
            icon={<Icon size={17} strokeWidth={1.8} />}
            key={label}
            label={label}
            value={value}
          />
        );
      })}
    </section>
  );
}

export default StaffSummaryGrid;
