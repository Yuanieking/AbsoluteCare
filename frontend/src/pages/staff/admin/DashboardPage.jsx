import { useOutletContext } from "react-router-dom";
import AdminDashboardOverview from "../../../components/staff/AdminDashboardOverview";
import StaffDashboardOverview from "../../../components/staff/StaffDashboardOverview";

function DashboardPage() {
  const { roleConfig } = useOutletContext();
  return roleConfig.label === "Admin" ? (
    <AdminDashboardOverview />
  ) : (
    <StaffDashboardOverview roleConfig={roleConfig} />
  );
}

export default DashboardPage;
