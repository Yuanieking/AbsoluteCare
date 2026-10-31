import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileBarChart } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../../../components/dashboard/PageHeader";
import {
  DashboardEmptyState,
  StatCard,
} from "../../../components/dashboard/DashboardPrimitives";
import Skeleton from "../../../components/dashboard/Skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  ResponsiveContainer,
} from "../../../components/ui/chart";
import { getAdminReports } from "../../../services/api/adminMonitoringApi";
import { formatAdminCurrency } from "../../../utils/adminFormatters";
import { getToastError, showError, showSuccess } from "../../../utils/toast";

const statusConfig = {
  pending: { label: "Pending", color: "var(--chart-amber)" },
  confirmed: { label: "Confirmed", color: "var(--chart-blue)" },
  completed: { label: "Completed", color: "var(--chart-green)" },
  cancelled: { label: "Cancelled", color: "var(--chart-red)" },
  no_show: { label: "No-show", color: "var(--chart-slate)" },
};

function bounds(range) {
  const now = new Date();
  if (range === "today")
    return {
      from: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      to: now,
    };
  if (range === "week")
    return { from: new Date(now.getTime() - 7 * 86400000), to: now };
  if (range === "quarter")
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 2, 1),
      to: now,
    };
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
}

function ChartShell({ title, description, empty, children }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <DashboardEmptyState
            icon={<FileBarChart size={20} />}
            title="No data for this period"
            message="Try a wider date range."
          />
        ) : (
          <div className="admin-chart-plot">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusChart({ items }) {
  const data = Object.keys(statusConfig)
    .map((key) => ({
      key,
      label: statusConfig[key].label,
      value: items.find((item) => item._id === key)?.count || 0,
    }))
    .filter((item) => item.value > 0);
  return (
    <ChartContainer
      config={Object.fromEntries(
        data.map((item) => [
          item.key,
          { label: item.label, color: statusConfig[item.key].color },
        ]),
      )}
      className="admin-recharts-wrap"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart accessibilityLayer>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={62}
            outerRadius={92}
            paddingAngle={3}
          >
            {data.map((item) => (
              <Cell key={item.key} fill={statusConfig[item.key].color} />
            ))}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

function WorkloadChart({ items }) {
  return (
    <ChartContainer
      config={{
        assigned: { label: "Assigned", color: "var(--chart-teal)" },
        completed: { label: "Completed", color: "var(--chart-green)" },
      }}
      className="admin-recharts-wrap"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          accessibilityLayer
          data={items}
          layout="vertical"
          margin={{ left: 8, right: 20 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={100}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="assigned"
            name="Assigned"
            fill="var(--color-assigned)"
            radius={[0, 5, 5, 0]}
          >
            <LabelList dataKey="assigned" position="right" fontSize={11} />
          </Bar>
          <Bar
            dataKey="completed"
            name="Completed"
            fill="var(--color-completed)"
            radius={[0, 5, 5, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

function SessionsChart({ items }) {
  const data = items.map((item) => ({
    ...item,
    label: item._id || "Unlabelled",
    value: item.count,
  }));
  return (
    <ChartContainer
      config={{ value: { label: "Sessions", color: "var(--chart-green)" } }}
      className="admin-recharts-wrap"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          accessibilityLayer
          data={data}
          margin={{ bottom: 34, left: 0, right: 12 }}
        >
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-22}
            textAnchor="end"
          />
          <YAxis
            allowDecimals={false}
            width={28}
            tickLine={false}
            axisLine={false}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey="value"
            name="Sessions"
            fill="var(--color-value)"
            radius={[5, 5, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

function PaymentsChart({ items }) {
  const data = items.map((item) => ({
    label: item._id || "Unrecorded",
    value: Number(item.total || 0),
  }));
  return (
    <>
      <ChartContainer
        config={{ value: { label: "Amount", color: "var(--chart-teal)" } }}
        className="admin-recharts-wrap"
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={58}
              outerRadius={88}
            >
              {data.map((item, index) => (
                <Cell
                  key={item.label}
                  fill={`var(--chart-${["teal", "green", "amber", "blue", "slate"][index % 5]})`}
                />
              ))}
            </Pie>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatAdminCurrency(value)}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
          </PieChart>
        </ResponsiveContainer>
      </ChartContainer>
    </>
  );
}

export default function ReportsPage() {
  const [range, setRange] = useState("month");
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    const selected = bounds(range);
    return getAdminReports({
      from: selected.from.toISOString(),
      to: selected.to.toISOString(),
    })
      .then((response) => setReports(response.data))
      .catch((error) =>
        showError(getToastError(error, "Unable to load reports.")),
      )
      .finally(() => setLoading(false));
  }, [range]);
  useEffect(() => {
    const request = window.setTimeout(load, 0);
    return () => window.clearTimeout(request);
  }, [load]);

  const status = reports?.appointments?.byStatus || [];
  const sessions = useMemo(() => reports?.sessions || [], [reports]);
  const workload = reports?.therapistWorkload || [];
  const methods = reports?.payments?.byMethod || [];
  const completed = status.find((item) => item._id === "completed")?.count || 0;
  const noShows = status.find((item) => item._id === "no_show")?.count || 0;
  const total = reports?.appointments?.total || 0;
  const summary = useMemo(
    () => [
      ["Appointments", total, "All appointments in this period"],
      [
        "New patients",
        reports?.patients?.new || 0,
        `${reports?.patients?.total || 0} total patients`,
      ],
      [
        "Completed sessions",
        sessions.reduce((sum, item) => sum + Number(item.count || 0), 0),
        "Recorded sessions",
      ],
      [
        "Revenue collected",
        formatAdminCurrency(reports?.payments?.revenue),
        "Paid appointments",
      ],
      [
        "Completion rate",
        `${Math.round((reports?.appointments?.completionRate || 0) * 100)}%`,
        `${completed} completed appointments`,
      ],
      ["No-shows", noShows, "Appointments marked no-show"],
      [
        "Top therapist",
        reports?.topTherapist?.name || "—",
        reports?.topTherapist
          ? `${reports.topTherapist.count} appointments`
          : "No assigned appointments",
      ],
      [
        "Outstanding payments",
        formatAdminCurrency(reports?.payments?.unpaid?.total),
        `${reports?.payments?.unpaid?.count || 0} appointments`,
      ],
    ],
    [completed, noShows, reports, sessions, total],
  );

  function exportReport() {
    const lines = [
      ["Metric", "Value"],
      ...summary.map(([label, value]) => [label, value]),
    ].map((row) =>
      row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
    );
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/csv" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `absolutecare-report-${range}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showSuccess("Report exported.");
  }

  return (
    <main className="staff-dashboard-content admin-dashboard">
      <PageHeader
        eyebrow="Clinic insights"
        title="Reports"
        description="A clear view of patients, care delivery, workload, and revenue."
        action={
          <div className="admin-report-controls">
            <div
              className="admin-report-range"
              role="tablist"
              aria-label="Report date range"
            >
              {[
                ["today", "Today"],
                ["week", "Week"],
                ["month", "Month"],
                ["quarter", "Quarter"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={range === key}
                  className={range === key ? "is-active" : ""}
                  onClick={() => setRange(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="staff-section-primary"
              onClick={exportReport}
            >
              <Download size={16} /> Export
            </button>
          </div>
        }
      />
      {loading ? (
        <section className="admin-report-kpi-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
            <article className="stat-card" key={item}>
              <Skeleton variant="text" width="48%" height="12px" />
              <Skeleton variant="heading" width="65%" height="38px" />
              <Skeleton variant="text" width="72%" height="13px" />
            </article>
          ))}
        </section>
      ) : reports ? (
        <>
          <h2 className="admin-section-title">Clinic summary</h2>
          <section className="admin-report-kpi-grid">
            {summary.map(([label, value, caption]) => (
              <StatCard
                key={label}
                label={label}
                value={value}
                caption={caption}
              />
            ))}
          </section>
          <section className="admin-chart-grid">
            <ChartShell
              title="Appointments by status"
              description="Status mix for the selected period."
              empty={!status.some((item) => item.count)}
            >
              <StatusChart items={status} />
            </ChartShell>
            <ChartShell
              title="Therapist workload"
              description="Assigned and completed appointments."
              empty={!workload.length}
            >
              <WorkloadChart items={workload} />
            </ChartShell>
            <ChartShell
              title="Completed sessions by service"
              description="Recorded sessions grouped by service."
              empty={!sessions.length}
            >
              <SessionsChart items={sessions} />
            </ChartShell>
            <ChartShell
              title="Payment methods"
              description="Collected payments by method."
              empty={!methods.length}
            >
              <PaymentsChart items={methods} />
              <p className="admin-report-callout">
                Outstanding:{" "}
                {formatAdminCurrency(reports.payments?.unpaid?.total)} across{" "}
                {reports.payments?.unpaid?.count || 0} appointments
              </p>
            </ChartShell>
          </section>
        </>
      ) : (
        <DashboardEmptyState
          icon={<FileBarChart size={22} />}
          title="Reports are unavailable"
          message="Try loading the clinic summary again."
          action={
            <button
              type="button"
              className="dashboard-primary-button"
              onClick={load}
            >
              Try again
            </button>
          }
        />
      )}
    </main>
  );
}
