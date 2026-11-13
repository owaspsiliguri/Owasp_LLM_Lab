// The single source of the scoring table shown in the UI. It mirrors the
// server-side leaderboard formula exactly: a captured flag is 100 points, a
// validated Fix-It is 150, and exploring/reading/chatting earns nothing.
export const POINTS = {
  explored: 0,
  flag: 100,
  fixit: 150,
}

export const LAB_MAX_POINTS = POINTS.flag + POINTS.fixit

export const POINT_ROWS = [
  { field: 'explored', label: 'Explore the lab target', points: POINTS.explored },
  { field: 'flag', label: 'Capture the flag', points: POINTS.flag },
  { field: 'fixit', label: 'Pass Fix-It validation', points: POINTS.fixit },
]

export function labPoints(done = {}) {
  let total = 0
  for (const { field, points } of POINT_ROWS) if (done[field]) total += points
  return total
}

export function scoreOf(modules = [], progress = {}) {
  const map = progress.modules || {}
  return modules.reduce((sum, m) => sum + labPoints(map[m.id] || {}), 0)
}
