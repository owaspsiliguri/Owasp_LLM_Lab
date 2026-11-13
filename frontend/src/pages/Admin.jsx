import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api.js'
import { useModules } from '../hooks/useModules.js'
import { useToast } from '../components/Toast.jsx'
import { LAB_MAX_POINTS } from '../services/points.js'
import { Badge, Button, Dialog, EmptyState, Loading, PageHeader, ProgressBar, Stat, Table, Tabs } from '../components/ui'
import Markdown from '../components/Markdown.jsx'
import Icon from '../components/Icons.jsx'

const EMPTY_OVERVIEW = { profiles: [], progress: [], attempts: [], attempt_count: 0 }
const SORTS = {
  email: (a, b) => (a.email || '').localeCompare(b.email || ''),
  created_at: (a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')),
  explored: (a, b) => a.explored - b.explored,
  flags: (a, b) => a.flags - b.flags,
  fixes: (a, b) => a.fixes - b.fixes,
  score: (a, b) => a.score - b.score,
  percent: (a, b) => a.percent - b.percent,
}

const STATUS_TONE = { published: 'success', draft: 'warning', archived: 'neutral' }
const TEMPLATE = `---
title: Prompt Injection Essentials
slug: prompt-injection-essentials
description: A short course description.
category: LLM01:2025 Prompt Injection
difficulty: Beginner
estimated_minutes: 45
---

Course introduction (optional overview lesson).

## First lesson
Lesson body...

## Second lesson
Lesson body...`

function toCsv(rows) {
  const header = ['email', 'full_name', 'joined', 'explored', 'flags', 'fixes', 'score', 'percent']
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
  return [header.join(','), ...rows.map((row) => [
    row.email, row.full_name || '', row.created_at || '', row.explored, row.flags, row.fixes, row.score, row.percent,
  ].map(escape).join(','))].join('\n')
}

function formatDate(value, withTime = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

function CoursePreview({ course, onClose }) {
  return (
    <section className="card p-5" aria-labelledby="course-preview-heading">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Preview</p>
          <h2 id="course-preview-heading" className="mt-0.5 truncate text-base font-semibold text-fg">{course.title}</h2>
          <p className="mt-0.5 text-xs text-fg-subtle">/{course.slug} · {course.lessons.length} lessons · checksum {String(course.checksum || '').slice(0, 12)}</p>
        </div>
        <Button size="sm" onClick={onClose}><Icon name="close" size={13} /> Close</Button>
      </div>
      <p className="mt-2 text-sm leading-6 text-fg-muted">{course.description}</p>
      <div className="mt-4 space-y-2">
        {course.lessons.map((lesson, index) => (
          <details key={lesson.id} open={index === 0} className="rounded-lg border border-line bg-surface-2/50">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-fg">{lesson.title}</summary>
            <div className="border-t border-line px-4 py-2"><Markdown source={lesson.markdown} /></div>
          </details>
        ))}
      </div>
    </section>
  )
}

export default function Admin() {
  const { modules } = useModules()
  const toast = useToast()
  const total = modules.length

  const [tab, setTab] = useState('roster')
  const [overview, setOverview] = useState(EMPTY_OVERVIEW)
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'percent', dir: 'desc' })

  const [file, setFile] = useState(null)
  const [uploadStatus, setUploadStatus] = useState('draft')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileInput = useRef(null)
  const [busyId, setBusyId] = useState(null)
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editorSource, setEditorSource] = useState('')
  const [editorLoading, setEditorLoading] = useState(false)
  const [editorSaving, setEditorSaving] = useState(false)
  const [editorError, setEditorError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, catalogue] = await Promise.all([api.adminOverview(), api.adminCourses()])
      setOverview({ ...EMPTY_OVERVIEW, ...data })
      setCourses(catalogue.courses || [])
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const rows = useMemo(() => {
    const perUser = new Map()
    for (const row of overview.progress) {
      const aggregate = perUser.get(row.user_id) || { explored: 0, flags: 0, fixes: 0 }
      if (row.explored) aggregate.explored += 1
      if (row.flag) aggregate.flags += 1
      if (row.fixit) aggregate.fixes += 1
      perUser.set(row.user_id, aggregate)
    }
    const max = total * LAB_MAX_POINTS
    const needle = query.trim().toLowerCase()
    const compare = SORTS[sort.key] || SORTS.percent
    return overview.profiles
      .filter((profile) => profile.role === 'student')
      .filter((profile) => !needle || (profile.email || '').toLowerCase().includes(needle) || (profile.full_name || '').toLowerCase().includes(needle))
      .map((profile) => {
        const aggregate = perUser.get(profile.id) || { explored: 0, flags: 0, fixes: 0 }
        const score = aggregate.flags * 100 + aggregate.fixes * 150
        return { ...profile, ...aggregate, score, percent: max ? Math.round((score / max) * 100) : 0 }
      })
      .sort((a, b) => (sort.dir === 'asc' ? compare(a, b) : compare(b, a)) || (a.email || '').localeCompare(b.email || ''))
  }, [overview, query, total, sort])

  const stats = useMemo(() => ({
    students: overview.profiles.filter((profile) => profile.role === 'student').length,
    flags: overview.progress.filter((row) => row.flag).length,
    fixes: overview.progress.filter((row) => row.fixit).length,
    explored: overview.progress.filter((row) => row.explored).length,
    points: overview.progress.reduce((sum, row) => sum + (row.flag ? 100 : 0) + (row.fixit ? 150 : 0), 0),
  }), [overview])

  const emailById = useMemo(() => new Map(overview.profiles.map((profile) => [profile.id, profile.email])), [overview.profiles])

  function toggleSort(key) {
    setSort((current) => ({ key, dir: current.key === key && current.dir === 'desc' ? 'asc' : 'desc' }))
  }

  function exportCsv() {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `llm-lab-students-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function upload(event) {
    event.preventDefault()
    if (uploading) return
    if (!file) {
      setUploadError('Choose a Markdown file first.')
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const created = await api.uploadCourse(file, uploadStatus)
      setCourses((current) => [created, ...current.filter((course) => course.id !== created.id)])
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
      toast.success(uploadStatus === 'published' ? 'Course published.' : 'Draft uploaded.')
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function setStatus(course, status) {
    if (busyId) return
    setBusyId(course.id)
    try {
      const updated = await api.setCourseStatus(course.id, status)
      setCourses((current) => current.map((item) => (item.id === course.id ? { ...item, ...updated } : item)))
      toast.success(status === 'published' ? `Published ${course.title}.` : `Moved ${course.title} back to draft.`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function replace(course, nextFile) {
    if (!nextFile || busyId) return
    setBusyId(course.id)
    try {
      const updated = await api.replaceCourse(course.id, nextFile)
      setCourses((current) => current.map((item) => (item.id === course.id ? { ...item, ...updated } : item)))
      if (preview?.id === course.id) setPreview(null)
      toast.success(`Replaced the source for ${course.title}.`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function openPreview(course) {
    setPreviewLoading(course.id)
    try {
      setPreview(await api.adminCourse(course.id))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setPreviewLoading(null)
    }
  }

  async function openEditor(course) {
    setEditing(course)
    setEditorSource('')
    setEditorError(null)
    setEditorLoading(true)
    try {
      const detail = await api.adminCourse(course.id)
      setEditorSource(detail.source_markdown || '')
    } catch (err) {
      setEditing(null)
      toast.error(err.message)
    } finally {
      setEditorLoading(false)
    }
  }

  function closeEditor() {
    if (editorSaving) return
    setEditing(null)
    setEditorSource('')
    setEditorError(null)
    setEditorLoading(false)
  }

  async function saveEditor(event) {
    event.preventDefault()
    if (!editing || editorSaving) return
    setEditorSaving(true)
    setEditorError(null)
    try {
      const updated = await api.updateCourseSource(editing.id, editorSource)
      setCourses((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)))
      if (preview?.id === updated.id) setPreview(null)
      toast.success(`Saved the source for ${updated.title}.`)
      setEditing(null)
      setEditorSource('')
    } catch (err) {
      setEditorError(err.message)
    } finally {
      setEditorSaving(false)
    }
  }

  async function remove() {
    if (!pendingDelete || busyId) return
    const course = pendingDelete
    setBusyId(course.id)
    try {
      await api.deleteCourse(course.id)
      setCourses((current) => current.filter((item) => item.id !== course.id))
      if (preview?.id === course.id) setPreview(null)
      toast.success(`Archived ${course.title}. The database row is preserved.`)
      setPendingDelete(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <Loading>Loading admin data…</Loading>

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Operations" title="Admin console" description="Roster, audit trail and course authoring." />
        <div role="alert" className="rounded-xl border border-danger-line bg-danger-tint p-4 text-sm text-danger-text">
          <p className="font-medium">Could not load admin data</p>
          <p className="mt-1">{error.message}</p>
          <p className="mt-1 text-xs">
            {error.status === 403
              ? 'Your account is not an administrator. Ask an operator to grant the admin role.'
              : 'Check that the backend is running and the platform migration has been applied.'}
          </p>
          <Button className="mt-3" onClick={load}>Try again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Admin console"
        description="Accounts, verified achievements and Markdown course authoring. Progress and course access are enforced by the API on every request."
        actions={(
          <Button onClick={load} disabled={loading}>
            <Icon name="refresh" size={14} />
            Refresh
          </Button>
        )}
      />

      <div className="border-b border-line pb-1">
        <Tabs
          tabs={[
            { value: 'roster', label: `Roster (${rows.length})` },
            { value: 'courses', label: `Courses (${courses.length})` },
          ]}
          value={tab}
          onChange={setTab}
          label="Admin sections"
        />
      </div>

      {tab === 'roster' && (
        <div className="space-y-6" role="tabpanel" id="panel-roster" aria-labelledby="tab-roster">
          <section aria-label="Platform totals" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            <Stat label="Students" value={stats.students} icon="user" />
            <Stat label="Labs explored" value={stats.explored} icon="labs" />
            <Stat label="Flags captured" value={stats.flags} icon="flag" />
            <Stat label="Fixes validated" value={stats.fixes} icon="code" />
            <Stat label="Points earned" value={stats.points} icon="trophy" />
          </section>

          <section aria-labelledby="students-heading">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="students-heading" className="text-lg font-semibold text-ink">Students</h2>
                <p className="text-sm text-slate-500">{rows.length} {rows.length === 1 ? 'account' : 'accounts'}{query ? ` matching “${query}”` : ''}.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="admin-search">Search students</label>
                <input
                  id="admin-search" className="input w-full sm:w-56" placeholder="Search email or name…"
                  value={query} onChange={(event) => setQuery(event.target.value)} type="search"
                />
                <Button size="sm" onClick={exportCsv} disabled={rows.length === 0}>
                  <Icon name="download" size={13} />
                  Export CSV
                </Button>
              </div>
            </div>

            {rows.length === 0 ? (
              <EmptyState
                icon="user"
                title={query ? 'No student matches that search' : 'No students yet'}
                body={query ? 'Try a different email or name.' : 'Share the signup link with your class and their progress will appear here.'}
              />
            ) : (
              <>
                <div className="card hidden overflow-hidden md:block">
                  <Table
                    caption="Students and their progress"
                    minWidth="56rem"
                    rows={rows}
                    rowKey={(row) => row.id}
                    columns={[
                      {
                        key: 'email',
                        header: 'Student',
                        sortable: true,
                        sorted: sort.key === 'email' ? sort.dir : undefined,
                        onSort: () => toggleSort('email'),
                        render: (row) => (
                          <div className="min-w-0">
                            <p className="truncate font-medium text-fg">{row.email}</p>
                            {row.full_name && <p className="truncate text-xs text-fg-subtle">{row.full_name}</p>}
                          </div>
                        ),
                      },
                      {
                        key: 'created_at',
                        header: 'Joined',
                        sortable: true,
                        sorted: sort.key === 'created_at' ? sort.dir : undefined,
                        onSort: () => toggleSort('created_at'),
                        render: (row) => <span className="whitespace-nowrap text-xs">{formatDate(row.created_at)}</span>,
                      },
                      ...['explored', 'flags', 'fixes', 'score'].map((key) => ({
                        key,
                        header: key === 'explored' ? 'Explored' : key === 'flags' ? 'Flags' : key === 'fixes' ? 'Fixes' : 'Score',
                        align: 'right',
                        sortable: true,
                        sorted: sort.key === key ? sort.dir : undefined,
                        onSort: () => toggleSort(key),
                        render: (row) => <span className="tabular-nums">{row[key]}</span>,
                      })),
                      {
                        key: 'percent',
                        header: 'Progress',
                        align: 'right',
                        sortable: true,
                        sorted: sort.key === 'percent' ? sort.dir : undefined,
                        onSort: () => toggleSort('percent'),
                        className: 'w-44',
                        render: (row) => (
                          <div className="flex items-center justify-end gap-2">
                            <ProgressBar value={row.percent} size="sm" className="w-24" />
                            <span className="w-9 text-right text-xs tabular-nums text-fg-muted">{row.percent}%</span>
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>

                <ul className="space-y-2 md:hidden">
                  {rows.map((row) => (
                    <li key={row.id} className="card p-4">
                      <p className="break-all text-sm font-medium text-ink">{row.email}</p>
                      {row.full_name && <p className="text-xs text-slate-500">{row.full_name}</p>}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge>{row.explored} explored</Badge>
                        <Badge>{row.flags} flags</Badge>
                        <Badge>{row.fixes} fixes</Badge>
                        <Badge tone="brand">{row.score} pts</Badge>
                      </div>
                      <ProgressBar value={row.percent} size="sm" className="mt-3" label={`${row.email} progress`} />
                      <p className="mt-1 text-xs text-slate-500">Joined {formatDate(row.created_at)} · {total} labs in the catalogue</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="card overflow-hidden" aria-labelledby="activity-heading">
            <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
              <h2 id="activity-heading" className="text-sm font-semibold text-ink">Recent attempts</h2>
              <span className="text-xs text-slate-500">{overview.attempt_count} recorded · newest 60 shown</span>
            </div>
            {overview.attempts.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">No flag or Fix-It attempts have been recorded yet.</p>
            ) : (
              <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                {overview.attempts.map((attempt) => (
                  <li key={attempt.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm sm:px-5">
                    <span className="min-w-0 truncate text-slate-700">{emailById.get(attempt.user_id) || 'unknown user'}</span>
                    <span className="font-mono text-[11px] text-slate-500">{String(attempt.module_id || '').toUpperCase()}</span>
                    <span className="badge badge-neutral capitalize">{attempt.kind}</span>
                    <span className={attempt.correct ? 'text-xs font-medium text-success-text' : 'text-xs font-medium text-danger-text'}>
                      {attempt.correct ? 'passed' : 'failed'}
                    </span>
                    <span className="ml-auto text-xs text-slate-400">{formatDate(attempt.created_at, true)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === 'courses' && (
        <div className="space-y-5" role="tabpanel" id="panel-courses" aria-labelledby="tab-courses">
          <section className="card p-5" aria-labelledby="upload-heading">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="upload-heading" className="text-base font-semibold text-ink">Upload a Markdown course</h2>
                <p className="mt-1 max-w-reading text-sm leading-6 text-slate-600">
                  The file needs YAML frontmatter and one lesson per <code className="rounded bg-slate-100 px-1 font-mono text-xs">##</code> heading.
                  It is parsed and validated on the server, then stored under a generated id; the original filename is never trusted.
                </p>
              </div>
              <Badge>Max 512 KiB</Badge>
            </div>

            <form onSubmit={upload} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
              <div>
                <label className="label" htmlFor="course-file">Markdown file</label>
                <input
                  ref={fileInput}
                  id="course-file"
                  type="file"
                  accept=".md,.markdown,.txt,text/markdown,text/plain"
                  className="input file:mr-3 file:rounded-md file:border-0 file:bg-surface-3 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-fg"
                  onChange={(event) => { setFile(event.target.files?.[0] || null); setUploadError(null) }}
                  disabled={uploading}
                />
              </div>
              <div>
                <label className="label" htmlFor="course-status">Initial status</label>
                <select id="course-status" className="input" value={uploadStatus} onChange={(event) => setUploadStatus(event.target.value)} disabled={uploading}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <Button type="submit" variant="primary" loading={uploading}>
                <Icon name="book" size={14} />
                Upload
              </Button>
            </form>

            {uploadError && (
              <p role="alert" className="mt-3 rounded-lg border border-danger-line bg-danger-tint px-3 py-2 text-sm text-danger-text">{uploadError}</p>
            )}

            <details className="mt-4 rounded-lg border border-line bg-surface-2/50">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-fg-muted">Frontmatter template</summary>
              <pre className="overflow-x-auto border-t border-line p-3 font-mono text-[12px] leading-6 text-fg-muted">{TEMPLATE}</pre>
            </details>
          </section>

          {preview && <CoursePreview course={preview} onClose={() => setPreview(null)} />}

          <section aria-labelledby="courses-heading">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="courses-heading" className="text-lg font-semibold text-ink">Courses</h2>
                <p className="text-sm text-slate-500">Drafts are visible only here. Archiving removes a course from the public catalogue but keeps its row and learner completions.</p>
              </div>
              <Button as={Link} to="/courses" size="sm">
                <Icon name="external" size={13} /> Public catalogue
              </Button>
            </div>

            {courses.length === 0 ? (
              <EmptyState icon="book" title="No courses yet" body="Upload the first Markdown course above. Learners see it as soon as it is published." />
            ) : (
              <>
                <div className="card hidden overflow-hidden lg:block">
                  <Table
                    caption="All authored courses"
                    minWidth="58rem"
                    rows={courses}
                    rowKey={(course) => course.id}
                    columns={[
                      {
                        key: 'title',
                        header: 'Course',
                        render: (course) => (
                          <div className="min-w-0">
                            <p className="truncate font-medium text-fg">{course.title}</p>
                            <p className="truncate font-mono text-[11px] text-fg-subtle">/{course.slug}</p>
                          </div>
                        ),
                      },
                      { key: 'status', header: 'Status', render: (course) => <Badge tone={STATUS_TONE[course.status] || 'neutral'}>{course.status}</Badge> },
                      { key: 'lesson_count', header: 'Lessons', align: 'right', render: (course) => <span className="tabular-nums">{course.lesson_count}</span> },
                      { key: 'updated_at', header: 'Updated', render: (course) => <span className="whitespace-nowrap text-xs">{formatDate(course.updated_at, true)}</span> },
                      {
                        key: 'actions',
                        header: 'Actions',
                        align: 'right',
                        className: 'w-[26rem]',
                        render: (course) => (
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <Button size="sm" aria-label={`Edit ${course.title}`} onClick={() => openEditor(course)}>
                              <Icon name="pencil" size={13} /> Edit
                            </Button>
                            <Button size="sm" loading={previewLoading === course.id} onClick={() => openPreview(course)}>
                              <Icon name="eye" size={13} /> Preview
                            </Button>
                            <Button
                              size="sm"
                              variant={course.status === 'published' ? undefined : 'primary'}
                              loading={busyId === course.id}
                              onClick={() => setStatus(course, course.status === 'published' ? 'draft' : 'published')}
                            >
                              {course.status === 'published' ? 'Unpublish' : 'Publish'}
                            </Button>
                            <label className={`btn btn-sm cursor-pointer ${busyId === course.id ? 'pointer-events-none opacity-60' : ''}`}>
                              <Icon name="book" size={13} /> Replace
                              <input
                                type="file"
                                accept=".md,.markdown,.txt,text/markdown,text/plain"
                                className="sr-only"
                                disabled={busyId === course.id}
                                onChange={(event) => {
                                  const next = event.target.files?.[0]
                                  event.target.value = ''
                                  void replace(course, next)
                                }}
                              />
                            </label>
                            <Button size="sm" variant="danger" onClick={() => setPendingDelete(course)}>
                              <Icon name="trash" size={13} /> Archive
                            </Button>
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>

                <ul className="space-y-2 lg:hidden">
                  {courses.map((course) => (
                    <li key={course.id} className="card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{course.title}</p>
                          <p className="truncate font-mono text-[11px] text-slate-500">/{course.slug}</p>
                        </div>
                        <Badge tone={STATUS_TONE[course.status] || 'neutral'}>{course.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{course.lesson_count} lessons · updated {formatDate(course.updated_at, true)}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Button size="sm" aria-label={`Edit ${course.title}`} onClick={() => openEditor(course)}>
                          <Icon name="pencil" size={13} /> Edit
                        </Button>
                        <Button size="sm" loading={previewLoading === course.id} onClick={() => openPreview(course)}>
                          <Icon name="eye" size={13} /> Preview
                        </Button>
                        <Button
                          size="sm"
                          variant={course.status === 'published' ? undefined : 'primary'}
                          loading={busyId === course.id}
                          onClick={() => setStatus(course, course.status === 'published' ? 'draft' : 'published')}
                        >
                          {course.status === 'published' ? 'Unpublish' : 'Publish'}
                        </Button>
                        <label className={`btn btn-sm cursor-pointer ${busyId === course.id ? 'pointer-events-none opacity-60' : ''}`}>
                          <Icon name="book" size={13} /> Replace
                          <input
                            type="file"
                            accept=".md,.markdown,.txt,text/markdown,text/plain"
                            className="sr-only"
                            disabled={busyId === course.id}
                            onChange={(event) => {
                              const next = event.target.files?.[0]
                              event.target.value = ''
                              void replace(course, next)
                            }}
                          />
                        </label>
                        <Button size="sm" variant="danger" onClick={() => setPendingDelete(course)}>
                          <Icon name="trash" size={13} /> Archive
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      )}

      <Dialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Archive this course?"
        description={pendingDelete ? `“${pendingDelete.title}” disappears from the public catalogue. The database row and every learner completion are preserved, so it can be restored by an operator.` : ''}
        tone="danger"
        footer={(
          <>
            <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={remove} loading={Boolean(pendingDelete && busyId === pendingDelete.id)} data-autofocus>
              Archive course
            </Button>
          </>
        )}
      />

      <Dialog
        open={Boolean(editing)}
        onClose={closeEditor}
        title={editing ? `Edit ${editing.title}` : 'Edit course'}
        description="Change the Markdown source in place. YAML frontmatter is required, the server re-validates every lesson, and the current publication status is preserved."
        panelClassName="max-w-3xl"
        footer={(
          <>
            <Button onClick={closeEditor} disabled={editorSaving}>Cancel</Button>
            <Button variant="primary" type="submit" form="course-editor-form" loading={editorSaving} disabled={editorLoading}>
              Save changes
            </Button>
          </>
        )}
      >
        {editorLoading ? <Loading>Loading the Markdown source…</Loading> : (
          <form id="course-editor-form" onSubmit={saveEditor}>
            <label className="label" htmlFor="course-source">Markdown source</label>
            <textarea
              id="course-source"
              className="input mt-1 h-80 w-full resize-y font-mono text-xs leading-6"
              value={editorSource}
              onChange={(event) => setEditorSource(event.target.value)}
              spellCheck={false}
              disabled={editorSaving}
            />
            <p className="mt-2 text-xs leading-5 text-fg-subtle">
              One lesson per <code className="rounded bg-surface-3 px-1 font-mono">##</code> heading. Changing the slug is allowed but must not collide with another course;
              drafts stay drafts and published courses stay published.
            </p>
            {editorError && (
              <p role="alert" className="mt-3 rounded-lg border border-danger-line bg-danger-tint px-3 py-2 text-sm text-danger-text">{editorError}</p>
            )}
          </form>
        )}
      </Dialog>
    </div>
  )
}
