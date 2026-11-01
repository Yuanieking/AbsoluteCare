import { NavLink } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen, Phone } from 'lucide-react'
import Logo from '@/components/brand/Logo'
import { groupSections, type NavSection, type RoleNav } from '@/app/nav-config'
import { cn } from '@/lib/utils'

type Badges = Partial<Record<string, boolean>>

const itemBase =
  'relative flex h-9 items-center gap-2.5 rounded-md text-[13px] transition-colors duration-150 ease-snap'

type RailNavProps = {
  sections: NavSection[]
  collapsed: boolean
  badges?: Badges
  onNavigate?: () => void
}

export function RailNav({ sections, collapsed, badges, onNavigate }: RailNavProps) {
  const groups = groupSections(sections)

  return (
    <>
      {groups.map((group, index) => (
        <div key={group.group || index} className="flex flex-col">
          {group.group ? (
            <p
              className={cn(
                'max-h-10 overflow-hidden px-2.5 pb-1 text-[10.5px] font-medium text-ink-faint whitespace-nowrap transition-[opacity,max-height,padding] duration-200 ease-snap',
                index === 0 ? 'pt-1' : 'pt-4',
                collapsed && 'max-h-0 pt-0 pb-0 opacity-0',
              )}
            >
              {group.group}
            </p>
          ) : null}
          {group.group && index > 0 ? (
            <div
              aria-hidden="true"
              className={cn(
                'mx-2 h-px bg-hairline-in transition-[opacity,margin] duration-200 ease-snap',
                collapsed ? 'my-2 opacity-100' : 'my-0 opacity-0',
              )}
            />
          ) : null}
          {group.items.map((section) => {
            const Icon = section.icon
            const hasBadge = Boolean(badges?.[section.key])
            return (
              <NavLink
                key={section.key}
                to={section.to}
                end={section.end}
                title={collapsed ? section.label : undefined}
                aria-label={collapsed ? section.label : undefined}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    itemBase,
                    'overflow-hidden px-2.5',
                    isActive
                      ? 'bg-panel font-semibold text-ink shadow-[0_1px_2px_rgba(23,33,29,0.06)] ring-1 ring-hairline'
                      : 'text-ink-soft hover:bg-panel/60 hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'size-[17px] shrink-0 transition-colors duration-150',
                        isActive ? 'text-primary' : 'text-ink-faint',
                      )}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span
                      className={cn(
                        'truncate transition-opacity duration-200 ease-snap',
                        collapsed && 'opacity-0',
                      )}
                    >
                      {section.label}
                    </span>
                    {hasBadge ? (
                      <>
                        <span
                          aria-hidden="true"
                          className={cn(
                            'size-1.5 shrink-0 rounded-full bg-destructive',
                            collapsed ? 'absolute top-1.5 right-1.5' : 'ml-auto',
                          )}
                        />
                        <span className="sr-only">New items</span>
                      </>
                    ) : null}
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      ))}
    </>
  )
}

type RailProps = {
  nav: RoleNav
  collapsed: boolean
  onToggleCollapsed: () => void
  badges?: Badges
}

export function Rail({ nav, collapsed, onToggleCollapsed, badges }: RailProps) {
  return (
    <aside
      aria-label={`${nav.label} navigation`}
      className="hidden min-h-0 flex-col overflow-hidden px-3 pt-4 pb-3 min-[940px]:flex"
    >
      <div className="relative mb-2 flex h-8 items-center gap-2.5 px-1">
        <div
          aria-hidden={collapsed || undefined}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2.5 transition-opacity duration-150 ease-snap',
            collapsed && 'pointer-events-none opacity-0',
          )}
        >
          <Logo
            variant="mark"
            tone="dark"
            size="sm"
            to={nav.sections[0]?.to ?? '/'}
            className="size-7"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[13.5px] leading-tight font-semibold tracking-[-0.01em] text-ink">
              AbsoluteCare
            </p>
            <p className="truncate text-[10.5px] text-ink-faint">{nav.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Collapse navigation"
            aria-expanded
            tabIndex={collapsed ? -1 : 0}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-ink-faint transition-colors duration-150 ease-snap hover:bg-panel/60 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:outline-none"
          >
            <PanelLeftClose className="size-[17px]" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Expand navigation"
          aria-expanded={false}
          aria-hidden={collapsed ? undefined : true}
          tabIndex={collapsed ? 0 : -1}
          className={cn(
            'group absolute top-0 left-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-ink-faint transition-opacity duration-150 ease-snap hover:bg-panel/60 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:outline-none',
            collapsed ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <Logo
            variant="mark"
            tone="dark"
            size="sm"
            to={null}
            className="size-7 transition-opacity duration-150 ease-snap group-hover:opacity-0 group-focus-visible:opacity-0"
          />
          <PanelLeftOpen
            className="absolute size-[17px] opacity-0 transition-opacity duration-150 ease-snap group-hover:opacity-100 group-focus-visible:opacity-100"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </button>
      </div>

      <nav
        aria-label="Sections"
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto py-1"
      >
        <RailNav sections={nav.sections} collapsed={collapsed} badges={badges} />
      </nav>

      <div className="mt-2 flex items-center gap-1 border-t border-hairline pt-2">
        <a
          href={nav.helpHref}
          title="Contact the clinic"
          aria-label="Contact the clinic"
          className={cn(
            itemBase,
            'overflow-hidden px-2.5 text-ink-soft hover:bg-panel/60 hover:text-ink',
            collapsed ? 'w-9' : 'flex-1',
          )}
        >
          <Phone
            className="size-[16px] shrink-0 text-ink-faint"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span
            className={cn(
              'truncate text-[12.5px] transition-opacity duration-200 ease-snap',
              collapsed && 'opacity-0',
            )}
          >
            Contact clinic
          </span>
        </a>
      </div>
    </aside>
  )
}
