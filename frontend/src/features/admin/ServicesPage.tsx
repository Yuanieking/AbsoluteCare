import { zodResolver } from '@hookform/resolvers/zod'
import { ClipboardList, Plus, RefreshCw, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { DataTable, type AppColumnDef } from '@/components/data-table/DataTable'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { FilterBar } from '@/components/domain/FilterBar'
import { TextField, TextareaField } from '@/components/form/FormFields'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form } from '@/components/ui/form'
import { showPromise } from '@/lib/toast'
import { formatDuration, formatMoney } from './format'
import { useRetireService, useSaveService } from './mutations'
import { useAdminServices } from './queries'
import { serviceSchema, type ServiceValues } from './schemas'
import type { AdminService } from './types'

function toForm(service: AdminService | null): ServiceValues {
  return {
    name: service?.name || '',
    description: service?.description || '',
    category: service?.category || '',
    duration: String(service?.duration ?? 60),
    fee: String(service?.fee ?? 0),
  }
}

function ServiceDialog({
  service,
  open,
  onOpenChange,
}: {
  service: AdminService | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const save = useSaveService()
  const form = useForm<ServiceValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: toForm(service),
  })

  useEffect(() => {
    if (open) form.reset(toForm(service))
  }, [form, open, service])

  const onSubmit = form.handleSubmit(async (values) => {
    const request = save.mutateAsync({
      ...(service ? { id: service._id } : {}),
      name: values.name.trim(),
      description: values.description.trim(),
      category: values.category.trim(),
      duration: Number(values.duration),
      fee: Number(values.fee || 0),
    })
    showPromise(request, {
      loading: 'Saving service...',
      success: service ? 'Service updated.' : 'Service added.',
      error: 'Unable to save this service.',
    })
    try {
      await request
      onOpenChange(false)
    } catch {}
  })

  return (
    <Dialog open={open} onOpenChange={(next) => (save.isPending ? undefined : onOpenChange(next))}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{service ? 'Edit service' : 'Add service'}</DialogTitle>
          <DialogDescription>
            Keep the service catalogue and booking prices current.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-3" onSubmit={onSubmit} noValidate>
            <TextField<ServiceValues> control={form.control} name="name" label="Service name" />
            <TextareaField<ServiceValues>
              control={form.control}
              name="description"
              label="Description"
              rows={3}
            />
            <TextField<ServiceValues>
              control={form.control}
              name="category"
              label="Category or specialization"
              placeholder="Sports injury"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField<ServiceValues>
                control={form.control}
                name="duration"
                label="Duration (minutes)"
                type="number"
                min="1"
              />
              <TextField<ServiceValues>
                control={form.control}
                name="fee"
                label="Fee (₱)"
                type="number"
                min="0"
                step="0.01"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save service'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default function ServicesPage() {
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<{ service: AdminService | null } | null>(null)
  const services = useAdminServices()
  const retire = useRetireService()

  const term = search.trim().toLowerCase()
  const rows = (services.data ?? []).filter((service) => {
    if (!term) return true
    return [service.name, service.description, service.category]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(term)
  })

  function retireService(service: AdminService) {
    const ok = window.confirm(
      'This service will no longer be available for new bookings. Existing appointments won’t be affected.',
    )
    if (!ok) return
    const request = retire.mutateAsync(service._id)
    showPromise(request, {
      loading: 'Removing service...',
      success: 'Service removed from new bookings.',
      error: 'Unable to remove this service.',
    })
    request.catch(() => undefined)
  }

  const columns: AppColumnDef<AdminService>[] = [
    {
      id: 'service',
      meta: { label: 'Service' },
      header: 'Service',
      accessorFn: (service) => service.name || '',
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className="block truncate font-medium text-ink">
            {row.original.name || 'Unnamed service'}
          </span>
          <span className="block truncate text-[11.5px] text-ink-soft">
            {row.original.description || row.original.category || 'General therapy'}
          </span>
        </div>
      ),
    },
    {
      id: 'duration',
      meta: { label: 'Duration' },
      header: 'Duration',
      accessorFn: (service) => service.duration || 0,
      cell: ({ row }) => <span>{formatDuration(row.original.duration)}</span>,
    },
    {
      id: 'fee',
      meta: { label: 'Fee' },
      header: 'Fee',
      accessorFn: (service) => service.fee || 0,
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={row.original.fee ? 'tabular-nums' : 'tabular-nums text-signal'}>
            {formatMoney(row.original.fee)}
          </span>
          {row.original.fee ? null : (
            <span
              title="Payments for this service will record ₱0.00"
              className="rounded-full bg-signal-soft px-2 py-0.5 text-[10.5px] font-medium text-signal"
            >
              Fee not set
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      meta: { label: 'Status' },
      header: 'Status',
      accessorFn: (service) => (service.isActive ? 'active' : 'retired'),
      cell: ({ row }) => <StatusBadge status={row.original.isActive ? 'active' : 'retired'} />,
    },
    {
      id: 'actions',
      meta: { label: 'Actions' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setDialog({ service: row.original })}
          >
            Edit
          </Button>
          {row.original.isActive ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-destructive"
              onClick={() => retireService(row.original)}
            >
              Retire service
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <PageBody>
      <PageHeader
        eyebrow="Administration"
        title="Therapy services"
        description="Keep the service catalogue and booking prices current."
        actions={
          <Button type="button" onClick={() => setDialog({ service: null })}>
            <Plus size={15} aria-hidden="true" /> Add service
          </Button>
        }
      />

      <div className="mt-5">
        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search service, description or category"
        />
      </div>

      <DataTable
        className="mt-3"
        columns={columns}
        data={rows}
        isLoading={services.isLoading}
        getRowId={(service) => service._id}
        rowLabel={(service) => service.name || 'Service'}
        onRowClick={(service) => setDialog({ service })}
        caption="Therapy services"
        empty={
          services.error ? (
            <EmptyState
              icon={<RefreshCw size={22} />}
              title="We couldn’t load services"
              message={services.error.message}
              action={
                <Button type="button" variant="outline" onClick={() => void services.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : term ? (
            <EmptyState
              icon={<Search size={22} />}
              title="No services match your search"
              message={`Nothing found matching “${search.trim()}”.`}
              action={
                <Button type="button" variant="outline" onClick={() => setSearch('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<ClipboardList size={22} />}
              title="No therapy services configured"
              message="Add the first service to open bookings."
            />
          )
        }
      />

      <ServiceDialog
        service={dialog?.service ?? null}
        open={Boolean(dialog)}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
      />
    </PageBody>
  )
}
