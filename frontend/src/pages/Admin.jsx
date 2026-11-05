import { useCallback, useEffect, useMemo, useState } from 'react'
import { useModules } from '../hooks/useModules.js'
import { supabase } from '../services/supabase.js'
import { Badge, Button, EmptyState, Loading, PageHeader, ProgressBar, Stat, Table } from '../components/ui'
import Icon from '../components/Icons.jsx'

const SORTS = {
  email: (a, b) => (a.email || '').localeCompare(b.email || ''),
  created_at: (a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')),
  explored: (a, b) => a.explored - b.explored,
  flags: (a, b) => a.flags - b.flags,
  fixes: (a, b) => a.fixes - b.fixes,
  percent: (a, b) => a.percent - b.percent,
}

function toCsv(rows) {
  const header = ['email', 'full_name', 'joined', 'explored', 'flags', 'fixes', 'percent']
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
  return [header.join(','), ...rows.map((row) => [
    row.email, row.full_name || '', row.created_at || '', row.explored, row.flags, row.fixes, row.percent,
  ].map(escape).join(','))].join('\n')
}

function percentOf(row, total) {
  if (!total) return 0
  return Math.round(((row.explored + row.flags + row.fixes) / (total * 3)) * 100)
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

export default function Admin() {
  const { modules } = useModules()
  const total = modules.length
  const [state, setState] = useState({ loading: true, error: null, profiles: [], progress: [], attempts: [], attemptCount: 0 })
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'percent', dir: 'desc' })

  const load = useCallback(async () => {
    const sb = supabase()
    if (!sb) {
      setState({ loading: false, error: 'Supabase is not configured on this deployment.', profiles: [], progress: [], attempts: [], attemptCount: 0 })
      return
    }
    setState((current) => ({ ...current, loading: true, error: null }))
    const [profiles, progress, attempts, attemptCount] = await Promise.all([
      sb.from('profiles').select('id,email,full_name,role,created_at,last_sign_in_at').order('created_at'),
      sb.from('progress').select('user_id,module_id,explored,flag,fixit,updated_at'),
      sb.from('attempts').select('id,user_id,module_id,kind,correct,created_at').order('created_at', { ascending: false }).limit(60),
      sb.from('attempts').select('id', { count: 'exact', head: true }),
    ])
    const error = profiles.error || progress.error || attempts.error || attemptCount.error
    setState({
      loading: false,
      error: error ? error.message : null,
      profiles: profiles.data || [],
      progress: progress.data || [],
      attempts: attempts.data || [],
      attemptCount: attemptCount.count || 0,
    })
  }, [])

  useEffect(() => { load() }, [load])

  const rows = useMemo(() => {
    const perUser = new Map()
    for (const row of state.progress) {
      const aggregate = perUser.get(row.user_id) || { explored: 0, flags: 0, fixes: 0 }
      if (row.explored) aggregate.explored += 1
      if (row.flag) aggregate.flags += 1
      if (row.fixit) aggregate.fixes += 1
      perUser.set(row.user_id, aggregate)
    }
    const needle = query.trim().toLowerCase()
    const compare = SORTS[sort.key] || SORTS.percent
    return state.profiles
      .filter((profile) => profile.role === 'student')
      .filter((profile) => !needle || (profile.email || '').toLowerCase().includes(needle) || (profile.full_name || '').toLowerCase().includes(needle))
      .map((profile) => {
        const aggregate = perUser.get(profile.id) || { explored: 0, flags: 0, fixes: 0 }
        return { ...profile, ...aggregate, percent: percentOf(aggregate, total) }
      })
      .sort((a, b) => (sort.dir === 'asc' ? compare(a, b) : compare(b, a)) || (a.email || '').localeCompare(b.email || ''))
  }, [state, query, total, sort])

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

  const stats = useMemo(() => ({
    students: state.profiles.filter((profile) => profile.role === 'student').length,
    flags: state.progress.filter((row) => row.flag).length,
    fixes: state.progress.filter((row) => row.fixit).length,
    explored: state.progress.filter((row) => row.explored).length,
  }), [state])

  const emailById = useMemo(() => new Map(state.profiles.map((profile) => [profile.id, profile.email])), [state.profiles])

  if (state.loading) return <Loading>Loading admin data…</Loading>

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Admin console"
        description="Every account, lab run, captured flag and validated fix. Data is read directly from the Supabase project attached to this deployment."
        actions={(
          <>
            <label className="sr-only" htmlFor="admin-search">Search students</label>
            <input
              id="admin-search" className="input w-full sm:w-64" placeholder="Search email or name…"
              value={query} onChange={(event) => setQuery(event.target.value)} type="search"
            />
            <button type="button" className="btn" onClick={load} disabled={state.loading}>
              <Icon name="refresh" size={14} />
              Refresh
            </button>
          </>
        )}
      />

      {state.error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium">Could not load admin data</p>
          <p className="mt-1">{state.error}</p>
          <p className="mt-1 text-xs">If this is a fresh project, run <code className="rounded bg-ink-900 px-1 font-mono">supabase/schema.sql</code> in the Supabase SQL editor.</p>
        </div>
      )}

      <section aria-label="Platform totals" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <Stat label="Students" value={stats.students} icon="user" />
        <Stat label="Labs explored" value={stats.explored} icon="labs" />
        <Stat label="Flags captured" value={stats.flags} icon="flag" />
        <Stat label="Fixes validated" value={stats.fixes} icon="code" />
        <Stat label="Attempts logged" value={state.attemptCount} icon="terminal" />
      </section>

      <section aria-labelledby="students-heading">
        <div className="mb-3 flex items-end justify-between gap-2">
          <div>
            <h2 id="students-heading" className="text-lg font-semibold text-ink">Students</h2>
            <p className="text-sm text-slate-500">{rows.length} {rows.length === 1 ? 'account' : 'accounts'}{query ? ` matching “${query}”` : ''}.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-slate-500 sm:block">{total} labs in the catalogue</span>
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
                minWidth="52rem"
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
                  ...['explored', 'flags', 'fixes'].map((key) => ({
                    key,
                    header: key === 'explored' ? 'Explored' : key === 'flags' ? 'Flags' : 'Fixes',
                    align: 'right',
                    sortable: true,
                    sorted: sort.key === key ? sort.dir : undefined,
                    onSort: () => toggleSort(key),
                    render: (row) => <span className="tabular-nums">{row[key]}/{total}</span>,
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
                  </div>
                  <ProgressBar value={row.percent} size="sm" className="mt-3" label={`${row.email} progress`} />
                  <p className="mt-1 text-xs text-slate-500">Joined {formatDate(row.created_at)}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card overflow-hidden" aria-labelledby="activity-heading">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
          <h2 id="activity-heading" className="text-sm font-semibold text-ink">Recent attempts</h2>
          <span className="text-xs text-slate-500">Newest first, 60 shown</span>
        </div>
        {state.attempts.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No flag or Fix-It attempts have been recorded yet.</p>
        ) : (
          <ul className="max-h-80 divide-y divide-line overflow-y-auto">
            {state.attempts.map((attempt) => (
              <li key={attempt.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm sm:px-5">
                <span className="min-w-0 truncate text-slate-700">{emailById.get(attempt.user_id) || 'unknown user'}</span>
                <span className="font-mono text-[11px] text-slate-500">{attempt.module_id.toUpperCase()}</span>
                <span className="badge badge-neutral capitalize">{attempt.kind}</span>
                <span className={attempt.correct ? 'text-xs font-medium text-emerald-700' : 'text-xs font-medium text-red-700'}>
                  {attempt.correct ? 'passed' : 'failed'}
                </span>
                <span className="ml-auto text-xs text-slate-400">{formatDate(attempt.created_at, true)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
