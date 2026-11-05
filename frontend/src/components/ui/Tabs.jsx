import { useEffect, useRef, useState } from 'react'

/**
 * Accessible tab list. Arrow keys / Home / End move focus and selection, which
 * is the behaviour the lab page relies on for its Challenge / Background tabs.
 * The strip scrolls horizontally on narrow screens; a mask on the trailing edge
 * shows there is more to reach when it does.
 */
export default function Tabs({ tabs, value, onChange, label, className = '', idPrefix = 'tab' }) {
  const refs = useRef([])
  const listRef = useRef(null)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    const list = listRef.current
    if (!list) return undefined
    const measure = () => setOverflowing(list.scrollWidth - list.clientWidth > 1)
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [tabs.length])

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
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={`scroll-x flex items-center gap-1 ${overflowing ? 'scroll-fade' : ''} ${className}`}
    >
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
