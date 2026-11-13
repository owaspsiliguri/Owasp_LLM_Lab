import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../services/api.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { useProgress } from '../hooks/useProgress.jsx'
import { useToast } from '../components/Toast.jsx'
import { Badge, Button, EmptyState, Loading } from '../components/ui'
import Markdown from '../components/Markdown.jsx'
import Icon from '../components/Icons.jsx'

export default function Course() {
  const { slug } = useParams()
  const { user, enabled } = useAuth()
  const progress = useProgress()
  const toast = useToast()
  const [state, setState] = useState({ loading: true, error: null, course: null })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }))
    try {
      const course = await api.course(slug)
      setState({ loading: false, error: null, course })
    } catch (error) {
      setState({ loading: false, error, course: null })
    }
  }, [slug])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!state.course) return undefined
    const previous = document.title
    document.title = `${state.course.title} · OWASP LLM Lab`
    return () => { document.title = previous }
  }, [state.course])

  if (state.loading) return <Loading>Loading the course…</Loading>
  if (state.error) {
    if (state.error.status === 404) {
      return (
        <EmptyState
          icon="book"
          title="Course not found"
          body="This course is not published, was archived, or the address is wrong."
          action={<Button as={Link} to="/courses" variant="primary">Browse courses</Button>}
        />
      )
    }
    return (
      <div className="space-y-3">
        <Loading error={state.error.message} errorKind={state.error.kind} />
        <Button onClick={load}>Try again</Button>
      </div>
    )
  }

  const { course } = state
  const completed = Boolean(progress.courses?.[course.id]?.completed)

  async function complete() {
    if (busy || completed) return
    setBusy(true)
    try {
      await api.completeCourse(course.slug, true)
      await progress.refresh()
      toast.success('Course marked complete.')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={course.difficulty}>{course.difficulty}</Badge>
          <Badge>{course.category}</Badge>
          <Badge><Icon name="book" size={12} /> {course.lesson_count} {course.lesson_count === 1 ? 'lesson' : 'lessons'}</Badge>
          <Badge><Icon name="clock" size={12} /> {course.estimated_minutes} min</Badge>
          {completed && <Badge tone="success">Completed</Badge>}
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-display-sm font-semibold">{course.title}</h1>
            <p className="mt-1 max-w-reading text-sm leading-6 text-fg-muted">{course.description}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button as={Link} to="/courses" size="sm">
              <Icon name="arrowLeft" size={13} /> All courses
            </Button>
            {enabled && user ? (
              completed ? (
                <Badge tone="success">Saved to your account</Badge>
              ) : (
                <Button variant="primary" size="sm" loading={busy} onClick={complete}>
                  <Icon name="check" size={13} /> Mark complete
                </Button>
              )
            ) : (
              <Button as={Link} to="/login" size="sm">Sign in to save progress</Button>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[16rem_minmax(0,1fr)] xl:items-start">
        <nav aria-label="Course lessons" className="card p-4 xl:sticky xl:top-[7rem]">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Lessons</h2>
          <ol className="mt-2 space-y-1">
            {course.lessons.map((lesson, index) => (
              <li key={lesson.id}>
                <a
                  href={`#lesson-${lesson.slug}`}
                  className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
                >
                  <span className="mt-0.5 font-mono text-[11px] text-fg-subtle">{index + 1}</span>
                  <span className="min-w-0">{lesson.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-4">
          {course.lessons.map((lesson, index) => (
            <article key={lesson.id} id={`lesson-${lesson.slug}`} className="card scroll-mt-24 p-5 sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Lesson {index + 1}</p>
              <h2 className="mt-1 text-lg font-semibold text-fg">{lesson.title}</h2>
              <div className="mt-3"><Markdown source={lesson.markdown} /></div>
            </article>
          ))}

          <div className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-fg">Finished this course?</h2>
              <p className="mt-0.5 text-xs leading-5 text-fg-subtle">
                {enabled && user
                  ? 'Completion is recorded against your account and survives a browser change.'
                  : 'Sign in to record course completion on your account.'}
              </p>
            </div>
            {enabled && user ? (
              completed ? <Badge tone="success">Completed</Badge> : (
                <Button variant="primary" loading={busy} onClick={complete}>Mark complete</Button>
              )
            ) : (
              <Button as={Link} to="/login" variant="primary">Sign in</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
