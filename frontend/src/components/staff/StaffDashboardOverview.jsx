import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import StaffSummaryGrid from "./StaffSummaryGrid";
import {
  getSecretaryPayments,
  getSecretarySchedule,
} from "../../services/api/secretaryApi";

function StaffDashboardOverview({ roleConfig }) {
  const [summaries, setSummaries] = useState(roleConfig.summaries);
  useEffect(() => {
    if (roleConfig.label !== "Secretary") return;
    Promise.all([
      getSecretarySchedule({ status: "confirmed", date: "today" }),
      getSecretaryPayments({ status: "unpaid" }),
    ])
      .then(([schedule, payments]) => {
        setSummaries([
          ["Today's appointments", schedule.data.appointments.length, "SE-005"],
          ["Unpaid appointments", payments.data.appointments.length, "SE-008"],
        ]);
      })
      .catch(() => undefined);
  }, [roleConfig]);
  return (
    <main className="staff-dashboard-content">
      <section className="staff-dashboard-welcome">
        <div>
          <p className="staff-eyebrow">{roleConfig.label} workspace</p>
          <h1>{roleConfig.title}</h1>
          <p>{roleConfig.description}</p>
        </div>
        <span className="staff-welcome-status">
          <CheckCircle2 size={15} /> System ready
        </span>
      </section>
      <StaffSummaryGrid summaries={summaries} />
    </main>
  );
}

export default StaffDashboardOverview;
