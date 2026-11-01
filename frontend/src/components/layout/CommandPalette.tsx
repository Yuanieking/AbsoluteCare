import { useNavigate } from 'react-router-dom'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import type { RoleNav } from '@/app/nav-config'

type CommandPaletteProps = {
  nav: RoleNav
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ nav, open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()
  const tabbed = nav.sections.find((section) => section.tabs)

  function go(to: string) {
    onOpenChange(false)
    navigate(to)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Jump to a page"
      description="Search every section in this portal."
    >
      <CommandInput placeholder="Jump to a page…" />
      <CommandList>
        <CommandEmpty>No page matches that search.</CommandEmpty>
        <CommandGroup heading="Pages">
          {nav.sections.map((section) => (
            <CommandItem
              key={section.key}
              value={`${section.label} ${section.key}`}
              onSelect={() => go(section.to)}
            >
              <section.icon aria-hidden="true" />
              <span>{section.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        {tabbed?.tabs ? (
          <CommandGroup heading={tabbed.label}>
            {tabbed.tabs.map((tab) => (
              <CommandItem
                key={tab.key}
                value={`${tabbed.label} ${tab.label}`}
                onSelect={() => go(tab.to)}
              >
                <tabbed.icon aria-hidden="true" />
                <span>{tab.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  )
}
