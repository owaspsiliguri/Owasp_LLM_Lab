import { useEffect, useRef } from 'react'
import Button from './Button.jsx'

/**
 * Small confirmation/announcement dialog. Traps focus, closes on Escape or a
 * backdrop click, and returns focus to the element that opened it.
 */
export default function Dialog({
  open, onClose, title, description, children, footer, tone = 'neutral', labelledBy = 'dialog-title',
}) {
  const panelRef = useRef(null)
  const restoreRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    restoreRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusable = () => Array.from(
      panelRef.current?.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])') || [],
    ).filter((element) => element.getClientRects().length > 0)

    const frame = requestAnimationFrame(() => {
      const target = panelRef.current?.querySelector('[data-autofocus]') || focusable()[0]
      target?.focus()
    })

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const elements = focusable()
      if (!elements.length) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      if (restoreRef.current instanceof HTMLElement) restoreRef.current.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative w-full max-w-md animate-pop-in rounded-xl border border-line-strong bg-surface p-5 shadow-drawer"
      >
        <h2 id={labelledBy} className="text-base font-semibold text-fg">{title}</h2>
        {description && <p className="mt-1.5 text-sm leading-6 text-fg-muted">{description}</p>}
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {footer || (
            <>
              <Button onClick={onClose}>Cancel</Button>
              <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onClose} data-autofocus>
                Close
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
