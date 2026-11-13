import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { useProgress } from '../hooks/useProgress.jsx'
import { useToast } from './Toast.jsx'
import Icon from './Icons.jsx'
import { Button } from './ui'
import { POINTS } from '../services/points.js'

const FLAG_PATTERN = /^FLAG\{[^}\s]+\}$/

export default function FlagForm({ module, disabled = false, suggestion = null }) {
  const { refresh } = useProgress()
  const toast = useToast()
  const [flag, setFlag] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)

  // A flag found in a chat response is offered here, but the learner still
  // decides when to submit it.
  useEffect(() => {
    if (suggestion) setFlag(suggestion)
  }, [suggestion])

  async function submit(event) {
    event.preventDefault()
    if (busy || disabled) return
    const value = flag.trim()
    if (!value) {
      setFeedback({ tone: 'error', text: 'Enter the flag you captured before submitting.' })
      return
    }
    if (!FLAG_PATTERN.test(value)) {
      setFeedback({ tone: 'error', text: 'Flags look like FLAG{...}. Check for a missing brace or a stray space.' })
      return
    }

    setBusy(true)
    setFeedback(null)
    try {
      const result = await api.flag(module.id, value)
      if (result.correct) {
        setFlag('')
        setFeedback({ tone: 'success', text: result.message || 'Correct. Flag recorded.' })
        toast.success(result.status === 'already_completed' ? 'This flag was already on your account.' : 'Flag captured.')
        await refresh()
      } else {
        setFeedback({ tone: 'error', text: result.message || 'Not the right flag. Keep testing.' })
      }
    } catch (error) {
      if (error.status === 429) {
        setFeedback({ tone: 'warning', text: error.message })
      } else {
        setFeedback({ tone: 'error', text: `Could not check the flag: ${error.message}` })
      }
    } finally {
      setBusy(false)
    }
  }

  const tone = {
    success: 'border-success-line bg-success-tint text-success-text',
    error: 'border-danger-line bg-danger-tint text-danger-text',
    warning: 'border-warning-line bg-warning-tint text-warning-text',
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div>
        <label className="label" htmlFor={`flag-${module.id}`}>Captured flag</label>
        <input
          id={`flag-${module.id}`}
          className="input input-mono"
          value={flag}
          onChange={(event) => { setFlag(event.target.value); if (feedback?.tone === 'error') setFeedback(null) }}
          placeholder="FLAG{...}"
          maxLength={200}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-describedby={`flag-${module.id}-help`}
          aria-invalid={feedback?.tone === 'error' ? true : undefined}
          disabled={busy || disabled}
        />
        <p id={`flag-${module.id}-help`} className="mt-1 text-xs leading-5 text-fg-subtle">
          Worth {POINTS.flag} points. Press Enter or use the button; the server validates every submission.
        </p>
      </div>

      <Button type="submit" variant="primary" className="w-full" disabled={disabled} loading={busy}>
        {busy ? 'Checking…' : 'Submit flag'}
      </Button>

      <div aria-live="polite">
        {feedback && (
          <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${tone[feedback.tone]}`}>
            <Icon name={feedback.tone === 'success' ? 'check' : feedback.tone === 'error' ? 'x' : 'alert'} size={15} className="mt-0.5 shrink-0" />
            <span>{feedback.text}</span>
          </p>
        )}
      </div>
    </form>
  )
}
