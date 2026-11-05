import { useRef } from 'react'

/**
 * Accessible tab list. Arrow keys / Home / End move focus and selection, which
 * is the behaviour the lab page relies on for its Challenge / Background tabs.
 */
export default function Tabs({ tabs, value, onChange, label, className = '', idPrefix = 'tab' }) {
  const refs = useRef([])

  function onKeyDown(event, index) {
    let target = null
    if (event.key === 'ArrowRight') target = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') target = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') target = 0
    else if (event.key === 'End') target = tabs.length - 1
    if (target === null) return
    event.preventDefault()
    onChange(tabs[target].value)
    refs.current[target]?.focus()
  }

  return (
    <div role="tablist" aria-label={label} className={`flex items-center gap-1 overflow-x-auto ${className}`}>
      {tabs.map((tab, index) => {
        const selected = value === tab.value
        return (
          <button
            key={tab.value}
            ref={(element) => { refs.current[index] = element }}
            type="button"
            role="tab"
            id={`${idPrefix}-${tab.value}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`tab ${selected ? 'tab-active' : ''}`}
          >
            {tab.label}
            {tab.done && <span className="text-success" aria-label="completed">✓</span>}
          </button>
        )
      })}
    </div>
  )
}
