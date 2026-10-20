import PageHeader from '../dashboard/PageHeader'

function StaffPageHeader({ eyebrow, title, description, action, children }) {
  return (
    <PageHeader
      className="staff-section-heading"
      eyebrow={eyebrow}
      title={title}
      description={description}
      action={action}
    >
      {children}
    </PageHeader>
  )
}

export default StaffPageHeader

