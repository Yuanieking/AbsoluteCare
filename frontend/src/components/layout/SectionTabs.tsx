import { Link } from 'react-router-dom'
import type { NavTab } from '@/app/nav-config'
import { cn } from '@/lib/utils'

type SectionTabsProps = {
  label: string
  tabs: NavTab[]
  activeKey: string
}

export function SectionTabs({ label, tabs, activeKey }: SectionTabsProps) {
  return (
    <nav
      aria-label={`${label} sections`}
      className="flex shrink-0 items-center gap-5 overflow-x-auto border-b border-hairline-in px-5 [scrollbar-width:none] sm:px-8 [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey
        return (
          <Link
            key={tab.key}
            to={tab.to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px inline-flex h-10 shrink-0 items-center border-b-2 text-[12.5px] whitespace-nowrap transition-colors duration-150 ease-snap',
              active
                ? 'border-primary font-semibold text-ink'
                : 'border-transparent text-ink-soft hover:border-hairline hover:text-ink',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
