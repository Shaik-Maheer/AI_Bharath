import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';

function valueAt(row, accessor) {
  if (typeof accessor === 'function') return accessor(row);
  return accessor.split('.').reduce((value, key) => value?.[key], row);
}

export default function SortableTable({ columns, rows, empty, rowKey = '_id', onRowClick }) {
  const [sort, setSort] = useState({ key: columns[0]?.key, direction: 'asc' });

  const sortedRows = useMemo(() => {
    const column = columns.find((item) => item.key === sort.key);
    if (!column) return rows;
    return [...rows].sort((a, b) => {
      const left = valueAt(a, column.accessor || column.key);
      const right = valueAt(b, column.accessor || column.key);
      const result = String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true, sensitivity: 'base' });
      return sort.direction === 'asc' ? result : -result;
    });
  }, [columns, rows, sort]);

  function toggle(key) {
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  }

  if (!rows.length) return empty;

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => {
                const SortIcon = sort.key === column.key ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;
                return (
                  <th key={column.key} className="table-header" onClick={() => toggle(column.key)}>
                    <span className="inline-flex items-center gap-2">
                      {column.label}
                      <SortIcon className="h-3.5 w-3.5" />
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedRows.map((row, index) => (
              <tr
                key={row[rowKey] || row.id || index}
                className={`${index % 2 ? 'bg-slate-50/60' : 'bg-white'} ${onRowClick ? 'cursor-pointer hover:bg-amber-50/50' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <td key={column.key} className="table-cell">
                    {column.render ? column.render(row) : valueAt(row, column.accessor || column.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

