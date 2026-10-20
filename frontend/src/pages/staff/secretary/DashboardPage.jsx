import { useOutletContext } from "react-router-dom";
import StaffDashboardOverview from "../../../components/staff/StaffDashboardOverview";

function DashboardPage() {
  const { roleConfig } = useOutletContext();
  return <StaffDashboardOverview roleConfig={roleConfig} />;
}

export default DashboardPage;
