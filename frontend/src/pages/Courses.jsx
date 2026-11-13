import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api.js'
import { useProgress } from '../hooks/useProgress.jsx'
import { Badge, Button, EmptyState, Loading, PageHeader } from '../components/ui'
import Icon from '../components/Icons.jsx'

function CourseCard({ course, completed }) {
  return (
    <article className="card card-hover flex flex-col">
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={course.difficulty}>{course.difficulty}</Badge>
          <Badge>{course.category}</Badge>
          {completed && <Badge tone="success" className="ml-auto">Completed</Badge>}
        </div>
        <h2 className="mt-3 text-base font-semibold leading-snug">
          <Link to={`/courses/${course.slug}`} className="transition-colors hover:text-accent-text">{course.title}</Link>
        </h2>
        <p className="mt-1.5 line-clamp-3 flex-1 text-sm leading-6 text-fg-muted">{course.description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-fg-subtle">
          <span className="inline-flex items-center gap-1"><Icon name="book" size={13} /> {course.lesson_count} {course.lesson_count === 1 ? 'lesson' : 'lessons'}</span>
          <span className="inline-flex items-center gap-1"><Icon name="clock" size={13} /> {course.estimated_minutes} min</span>
          <Link to={`/courses/${course.slug}`} className="ml-auto inline-flex items-center gap-1 font-medium text-accent-text hover:underline">
            Open course <Icon name="arrowRight" size={13} />
          </Link>
        </div>
      </div>
    </article>
  )
}

export default function Courses() {
  const progress = useProgress()
  const [state, setState] = useState({ loading: true, error: null, courses: [] })
  const [category, setCategory] = useState('All')

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }))
    try {
      const result = await api.courses()
      setState({ loading: false, error: null, courses: result.courses || [] })
    } catch (error) {
      setState({ loading: false, error, courses: [] })
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const categories = useMemo(() => {
    const seen = new Set()
    for (const course of state.courses) if (course.category) seen.add(course.category)
    return ['All', ...Array.from(seen).sort()]
  }, [state.courses])

  const visible = category === 'All' ? state.courses : state.courses.filter((course) => course.category === category)

  if (state.loading && !state.courses.length) return <Loading>Loading the course catalogue…</Loading>
  if (state.error) {
    return <Loading error={state.error.message} errorKind={state.error.kind} onRetry={load} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Courses"
        title="Guided courses"
        description="Structured Markdown courses published by the platform administrators. Every course is stored and served by this deployment."
        actions={categories.length > 2 ? (
          <div className="flex flex-wrap gap-1.5">
            {categories.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setCategory(name)}
                aria-pressed={category === name}
                className={`chip ${category === name ? 'chip-active' : ''}`}
              >
                {name}
              </button>
            ))}
          </div>
        ) : null}
      />

      {state.courses.length === 0 ? (
        <EmptyState
          icon="book"
          title="No courses published yet"
          body="An administrator can upload a Markdown course from the admin console. Published courses appear here immediately."
          action={<Button as={Link} to="/labs" variant="primary">Browse labs instead</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              completed={Boolean(progress.courses?.[course.id]?.completed)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
