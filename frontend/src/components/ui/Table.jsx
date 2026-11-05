import Icon from '../Icons.jsx'

/**
 * Table shell with one consistent header treatment. Column widths come from the
 * caller; `minWidth` keeps wide admin tables scrollable instead of squashed.
 */
export function Table({ caption, columns, rows, rowKey, minWidth = '40rem', onRowClick, empty }) {
  if (!rows.length && empty) return empty
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-line bg-surface-2">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-4 py-2 text-xs font-medium uppercase tracking-wide text-fg-subtle ${column.align === 'right' ? 'text-right' : ''} ${column.className || ''}`}
              >
                {column.sortable ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded text-inherit hover:text-fg"
                    onClick={column.onSort}
                    aria-label={`Sort by ${column.header}`}
                  >
                    {column.header}
                    <Icon name="chevronDown" size={12} className={column.sorted === 'asc' ? 'rotate-180' : ''} />
                  </button>
                ) : column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`transition-colors hover:bg-surface-2 ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map((column) => (
                <td key={column.key} className={`px-4 py-2.5 align-middle text-fg-muted ${column.align === 'right' ? 'text-right' : ''} ${column.className || ''}`}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
