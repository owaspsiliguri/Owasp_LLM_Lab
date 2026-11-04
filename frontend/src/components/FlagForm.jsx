import { useState } from 'react'
import { api } from '../services/api.js'
import { useProgress } from '../hooks/useProgress.jsx'
import { useToast } from './Toast.jsx'
import Icon from './Icons.jsx'
import { POINTS } from '../services/points.js'

const FLAG_PATTERN = /^FLAG\{[^}\s]+\}$/

export default function FlagForm({ module, disabled = false }) {
  const { mark } = useProgress()
  const toast = useToast()
  const [flag, setFlag] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)

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
        mark(module.id, 'flag')
        setFlag('')
        setFeedback({ tone: 'success', text: result.message || 'Correct. Flag recorded.' })
        toast.success(result.status === 'already_completed' ? 'This flag was already on your account.' : 'Flag captured.')
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
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-red-200 bg-red-50 text-red-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
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
        <p id={`flag-${module.id}-help`} className="mt-1 text-xs text-slate-500">
          Worth {POINTS.flag} points. Press Enter or use the button to submit; validation happens on the server.
        </p>
      </div>

      <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={busy || disabled}>
        {busy ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
            Checking…
          </>
        ) : (
          <>
            <Icon name="flag" size={15} />
            Submit flag
          </>
        )}
      </button>

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
