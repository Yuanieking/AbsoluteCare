import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Menu, Search } from 'lucide-react'
import Logo from '@/components/brand/Logo'
import { TopProgressBar } from '@/components/feedback/TopProgressBar'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { filterNavByAccess, getActiveTab, getRoleNav, matchSection } from '@/app/nav-config'
import { useSettings } from '@/features/settings/provider'
import { cn } from '@/lib/utils'
import { CommandPalette } from './CommandPalette'
import { Rail, RailNav } from './Rail'
import { SectionTabs } from './SectionTabs'

const COLLAPSE_KEY = 'absolutecare.sidebar-collapsed'

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === 'true'
  } catch {
    return false
  }
}

type AppShellProps = {
  role: string
  context?: ReactNode
  actions?: ReactNode
  badges?: Partial<Record<string, boolean>>
  children: ReactNode
}

export function AppShell({ role, context, actions, badges, children }: AppShellProps) {
  const location = useLocation()
  const { settings } = useSettings()
  const nav = useMemo(
    () => filterNavByAccess(getRoleNav(role), role, settings.roleAccess),
    [role, settings.roleAccess],
  )
  const section = matchSection(nav, location.pathname)
  const activeTab = getActiveTab(section, location.search)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, String(collapsed))
    } catch {}
  }, [collapsed])

  useEffect(() => {
    document.documentElement.dataset.surface = 'portal'
    return () => {
      delete document.documentElement.dataset.surface
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const shortcut = /Mac|iPod|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K'
  const home = nav.sections[0]?.to ?? '/'

  return (
    <div
      data-surface="portal"
      style={{ '--rail': collapsed ? '60px' : '228px' } as CSSProperties}
      className="relative grid h-dvh grid-cols-1 overflow-hidden bg-canvas text-ink transition-[grid-template-columns] duration-200 ease-snap min-[940px]:grid-cols-[var(--rail)_minmax(0,1fr)] max-[939px]:h-auto max-[939px]:min-h-dvh max-[939px]:overflow-visible"
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-[13px] focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <TopProgressBar />

      <Rail
        nav={nav}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        badges={badges}
      />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[262px] gap-0 p-0">
          <SheetTitle className="sr-only">{nav.label} navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Sections available in this portal.
          </SheetDescription>
          <div className="flex items-center gap-2.5 border-b border-hairline px-4 py-3.5">
            <Logo variant="mark" tone="dark" size="sm" to={null} className="size-7" />
            <div className="min-w-0">
              <p className="truncate font-display text-[13.5px] leading-tight font-semibold text-ink">
                AbsoluteCare
              </p>
              <p className="truncate text-[10.5px] text-ink-faint">{nav.subtitle}</p>
            </div>
          </div>
          <nav aria-label="Sections" className="flex flex-col gap-0.5 overflow-y-auto p-3">
            <RailNav
              sections={nav.sections}
              collapsed={false}
              badges={badges}
              onNavigate={() => setMobileOpen(false)}
            />
          </nav>
        </SheetContent>
      </Sheet>

      <div className="flex min-h-0 min-w-0 flex-col min-[940px]:py-3 min-[940px]:pr-3">
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-hidden bg-panel',
            'min-[940px]:rounded-xl min-[940px]:border min-[940px]:border-hairline min-[940px]:shadow-card',
          )}
        >
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-hairline-in px-4 sm:px-5">
            <button
              type="button"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-ink-soft transition-colors duration-150 ease-snap hover:bg-sunk hover:text-ink focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:outline-none min-[940px]:hidden"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <Logo
              variant="mark"
              tone="dark"
              size="sm"
              to={home}
              className="size-7 min-[940px]:hidden"
            />

            <div className="flex min-w-0 flex-1 items-baseline gap-2">
              <strong className="truncate text-[13px] font-semibold tracking-[-0.005em] text-ink">
                {section?.label ?? nav.label}
              </strong>
              {activeTab ? (
                <>
                  <span aria-hidden="true" className="text-[11px] text-ink-faint/70">
                    /
                  </span>
                  <span className="truncate text-[12px] text-ink-soft max-[600px]:hidden">
                    {activeTab.label}
                  </span>
                </>
              ) : null}
              {context ? (
                <span className="truncate text-[12px] text-ink-faint max-[760px]:hidden">
                  {context}
                </span>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-label={`Search pages (${shortcut})`}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-hairline bg-panel px-2 text-[12.5px] text-ink-soft transition-colors duration-150 ease-snap hover:border-ink-faint/45 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:outline-none"
              >
                <Search className="size-[15px]" aria-hidden="true" />
                <span className="max-[760px]:hidden">Search</span>
                <kbd className="hidden rounded-[3px] border border-hairline px-1.5 py-px font-sans text-[10px] text-ink-faint min-[1080px]:inline">
                  {shortcut}
                </kbd>
              </button>
              {actions}
            </div>
          </header>

          {section?.tabs && activeTab ? (
            <SectionTabs label={section.label} tabs={section.tabs} activeKey={activeTab.key} />
          ) : null}

          <div
            id="main-content"
            tabIndex={-1}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] max-[939px]:overflow-visible"
          >
            {children}
          </div>
        </div>
      </div>

      <CommandPalette nav={nav} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}
