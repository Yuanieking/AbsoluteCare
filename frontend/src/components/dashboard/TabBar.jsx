import { useRef } from 'react'

export function TabBar({
  tabs = [],
  activeTab,
  onChange,
  ariaLabel = 'Filter tabs',
}) {
  const tabListRef = useRef(null)

  function handleKeyDown(event, index) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    let nextIndex = index

    if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + tabs.length) % tabs.length
    } else if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % tabs.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1
    }

    const nextTab = tabs[nextIndex]
    if (nextTab) {
      onChange(nextTab.key)
      const buttons = tabListRef.current?.querySelectorAll('button[role="tab"]')
      buttons?.[nextIndex]?.focus()
    }
  }

  return (
    <div
      ref={tabListRef}
      className="shared-tab-bar"
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tabItem, idx) => {
        const isActive = activeTab === tabItem.key
        return (
          <button
            key={tabItem.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={`shared-tab-btn${isActive ? ' is-active' : ''}`}
            onClick={() => onChange(tabItem.key)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
          >
            <span className="shared-tab-label">{tabItem.label}</span>
            {tabItem.count !== undefined && tabItem.count !== null && (
              <span className="shared-tab-chip" aria-hidden="true">
                {tabItem.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default TabBar
