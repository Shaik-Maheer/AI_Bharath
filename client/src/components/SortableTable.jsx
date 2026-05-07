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

  function reverseSort() {
    setSort((current) => ({ ...current, direction: current.direction === 'asc' ? 'desc' : 'asc' }));
  }

  function handleRowClick(event, row) {
    if (!onRowClick) return;
    const target = event.target;
    if (target instanceof Element && target.closest('a,button,input,select,textarea,label,[data-row-ignore-click="true"]')) return;
    onRowClick(row);
  }

  if (!rows.length) return empty;

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2.5 md:hidden">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Sort</span>
        <div className="flex min-w-0 items-center gap-2">
          <select
            value={sort.key || columns[0]?.key || ''}
            onChange={(event) => setSort((current) => ({ ...current, key: event.target.value }))}
            className="min-w-0 max-w-[12rem] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-gold"
          >
            {columns.map((column) => (
              <option key={column.key} value={column.key}>{column.label}</option>
            ))}
          </select>
          <button
            onClick={reverseSort}
            className="focus-ring rounded-md border border-slate-200 bg-white p-1.5 text-slate-600"
            title={`Sort ${sort.direction === 'asc' ? 'descending' : 'ascending'}`}
            aria-label={`Sort ${sort.direction === 'asc' ? 'descending' : 'ascending'}`}
          >
            {sort.direction === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {sortedRows.map((row, index) => (
          <article
            key={row[rowKey] || row.id || index}
            className={`${index % 2 ? 'bg-slate-50/50' : 'bg-white'} p-3 ${onRowClick ? 'cursor-pointer active:bg-amber-50/50' : ''}`}
            onClick={(event) => handleRowClick(event, row)}
          >
            <div className="grid gap-2">
              {columns.map((column) => {
                const content = column.render ? column.render(row) : valueAt(row, column.accessor || column.key);
                const display = content === null || content === undefined || content === '' ? '—' : content;
                return (
                  <div key={column.key} className="rounded-md border border-slate-100 bg-white px-2.5 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{column.label}</p>
                    <div className="mt-1 break-words text-sm text-slate-700">{display}</div>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
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
                onClick={(event) => handleRowClick(event, row)}
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
