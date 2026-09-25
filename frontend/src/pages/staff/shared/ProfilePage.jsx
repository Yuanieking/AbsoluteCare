import StaffTablePage from "../../../components/staff/StaffTablePage";

function ProfilePage() {
  return (
    <StaffTablePage
      eyebrow="Account"
      title="Profile"
      description="View and update your staff account details."
      columns={["Field", "Current value", "Action"]}
      emptyMessage="Profile details will appear here"
      action="Edit profile"
    />
  );
}

export default ProfilePage;
