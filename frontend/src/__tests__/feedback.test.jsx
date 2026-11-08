import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Loading } from '../components/ui/Feedback.jsx'

describe('backend wake-up feedback', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the Render wake-up notice after a request has been pending for a while', async () => {
    vi.useFakeTimers()
    render(<Loading>Loading the lab catalogue…</Loading>)

    expect(screen.queryByText(/Waking up the backend/)).not.toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(screen.getByText(/Waking up the backend. This may take up to a minute\./)).toBeInTheDocument()
  })

  it('labels a timeout as a backend startup delay instead of a generic failure', () => {
    render(<Loading error="The backend did not respond within 120 seconds." errorKind="timeout" />)
    expect(screen.getByRole('alert')).toHaveTextContent('The backend is taking longer than expected')
    expect(screen.getByRole('alert')).toHaveTextContent('The backend did not respond within 120 seconds.')
  })
})
