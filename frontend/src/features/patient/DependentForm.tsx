import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { SelectField, TextField, TextareaField } from '@/components/form/FormFields'
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
import { todayInManila } from '@/lib/format/patient'
import { getToastError, showError, showSuccess } from '@/lib/toast'
import { useSaveDependent } from './mutations'
import { dependentSchema, type DependentValues } from './schemas'
import type { Dependent } from './types'

const relationships = ['Child', 'Son', 'Daughter', 'Spouse', 'Parent', 'Sibling', 'Other']

function defaults(dependent?: Dependent | null): DependentValues {
  return {
    firstName: dependent?.firstName || '',
    lastName: dependent?.lastName || '',
    dateOfBirth: dependent?.dateOfBirth ? dependent.dateOfBirth.slice(0, 10) : '',
    relationship: dependent?.relationship || '',
    medicalNotes: dependent?.medicalNotes || '',
  }
}

export function DependentFormDialog({
  dependent,
  open,
  onOpenChange,
  onSaved,
}: {
  dependent?: Dependent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const mutation = useSaveDependent()
  const form = useForm<DependentValues>({
    resolver: zodResolver(dependentSchema),
    defaultValues: defaults(dependent),
  })

  useEffect(() => {
    if (open) form.reset(defaults(dependent))
  }, [dependent, form, open])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({ id: dependent?._id, ...values })
      showSuccess(dependent ? 'Dependent updated.' : 'Dependent added.')
      onOpenChange(false)
      onSaved()
    } catch (error) {
      showError(getToastError(error, 'Unable to save dependent.'))
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dependent ? 'Edit dependent' : 'Add a dependent'}</DialogTitle>
          <DialogDescription>
            Family members you book appointments for are linked to your account.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit} noValidate>
            <TextField<DependentValues>
              control={form.control}
              name="firstName"
              label="First name"
            />
            <TextField<DependentValues> control={form.control} name="lastName" label="Last name" />
            <TextField<DependentValues>
              control={form.control}
              name="dateOfBirth"
              label="Date of birth"
              type="date"
              min="1900-01-01"
              max={todayInManila()}
            />
            <SelectField<DependentValues>
              control={form.control}
              name="relationship"
              label="Relationship"
              placeholder="Select relationship"
              options={relationships.map((option) => ({ value: option, label: option }))}
            />
            <div className="sm:col-span-2">
              <TextareaField<DependentValues>
                control={form.control}
                name="medicalNotes"
                label="Notes (optional)"
                rows={4}
                maxLength={1000}
                placeholder="Conditions or special needs to keep in mind"
              />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
