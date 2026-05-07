import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock3, Eye, FileText, Filter, GitBranch, History, Search, ShieldAlert, User, X } from 'lucide-react';
import { api, friendlyError } from '../utils/api';
import { formatDate } from '../utils/date';
import { useToast } from '../context/ToastContext';
import ConfidenceBar from './ConfidenceBar';
import EmptyState from './EmptyState';
import StatusBadge from './StatusBadge';

const defaultFilters = {
  search: '',
  department: '',
  status: '',
  riskLevel: ''
};

const drawerTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'audit', label: 'Audit' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'evidence', label: 'Evidence' }
];

const riskPriority = ['Critical', 'High', 'Medium', 'Low'];

function normalize(value) {
  return String(value || '').toLowerCase();
}

function toActorLabel(actor) {
  if (!actor) return 'System';
  if (typeof actor === 'string') return actor;
  const role = actor.role ? ` (${actor.role})` : '';
  return `${actor.name || actor.email || 'System'}${role}`;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function filterDirectiveAudit(audit, directiveId) {
  if (!directiveId) return [];
  return (audit || []).filter((item) => String(item.directiveId?._id || item.directiveId || '') === String(directiveId));
}

function buildVerificationHistory(directive, directiveAudit) {
  const history = [];

  if (directive?.verifiedAt || directive?.verifiedBy) {
    history.push({
      key: `verified-${directive._id}`,
      action: String(directive.verificationStatus || 'verified').replace(/_/g, ' '),
      actor: directive.verifiedBy,
      at: directive.verifiedAt,
      details: 'Primary verification decision recorded.'
    });
  }

  (directive?.editHistory || []).forEach((edit, index) => {
    history.push({
      key: `edit-${directive?._id || 'directive'}-${index}`,
      action: `Field edit: ${edit.field}`,
      actor: edit.editedBy,
      at: edit.editedAt,
      details: `${edit.oldValue || '""'} -> ${edit.newValue || '""'}${edit.reason ? ` (${edit.reason})` : ''}`
    });
  });

  (directiveAudit || []).forEach((item) => {
    const changes = Array.isArray(item.details?.changes) ? item.details.changes : [];
    const changeText = changes
      .slice(0, 2)
      .map((change) => `${change.field}: ${change.oldValue || '""'} -> ${change.newValue || '""'}`)
      .join(' | ');

    history.push({
      key: item._id || `${item.action}-${item.performedAt}`,
      action: String(item.action || '').replace(/_/g, ' '),
      actor: item.performedBy,
      at: item.performedAt,
      details: changeText || item.details?.reason || item.details?.note || ''
    });
  });

  return history.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
}

function buildEscalationNotes(directive, directiveAudit) {
  const fromTracking = (directive?.trackingHistory || [])
    .filter((entry) => entry.status === 'Escalated' || /escalat/i.test(String(entry.note || '')))
    .map((entry, index) => ({
      key: `tracking-${directive?._id || 'directive'}-${index}`,
      note: entry.note || `Tracking moved to ${entry.status}.`,
      by: entry.updatedBy,
      at: entry.updatedAt
    }));

  const fromAudit = (directiveAudit || [])
    .filter((item) => item.action === 'status_changed' && (item.details?.newValue === 'Escalated' || /escalat/i.test(String(item.details?.note || ''))))
    .map((item) => ({
      key: `audit-${item._id}`,
      note: item.details?.note || `Status changed from ${item.details?.oldValue || '-'} to ${item.details?.newValue || 'Escalated'}.`,
      by: item.performedBy,
      at: item.performedAt
    }));

  return [...fromTracking, ...fromAudit].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
}

function deadlineText(row) {
  if (!row.deadline) return 'Not set';
  const due = new Date(row.deadline);
  const overdue = due < new Date() && row.trackingStatus !== 'Completed';
  return overdue ? `${formatDate(due)} (Overdue)` : formatDate(due);
}

export default function TrustedActionRegister({ rows = [] }) {
  const { notify } = useToast();
  const [filters, setFilters] = useState(defaultFilters);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerTab, setDrawerTab] = useState('overview');
  const [drawerData, setDrawerData] = useState(null);
  const [openingRowId, setOpeningRowId] = useState('');

  const departmentOptions = useMemo(() => uniqueSorted(rows.map((item) => item.responsibleDepartment)), [rows]);
  const statusOptions = useMemo(() => uniqueSorted(rows.map((item) => item.trackingStatus)), [rows]);
  const riskOptions = useMemo(() => {
    const set = new Set(rows.map((item) => item.riskLevel).filter(Boolean));
    const sortedPriority = riskPriority.filter((item) => set.has(item));
    const extras = [...set].filter((item) => !riskPriority.includes(item)).sort((a, b) => a.localeCompare(b));
    return [...sortedPriority, ...extras];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const searchTerm = normalize(filters.search.trim());
    return [...rows]
      .filter((item) => {
        if (searchTerm && !normalize(item.caseId?.caseId).includes(searchTerm)) return false;
        if (filters.department && item.responsibleDepartment !== filters.department) return false;
        if (filters.status && item.trackingStatus !== filters.status) return false;
        if (filters.riskLevel && item.riskLevel !== filters.riskLevel) return false;
        return true;
      })
      .sort((a, b) => {
        const byDeadline = new Date(a.deadline || 0) - new Date(b.deadline || 0);
        if (byDeadline !== 0) return byDeadline;
        return String(a.caseId?.caseId || '').localeCompare(String(b.caseId?.caseId || ''));
      });
  }, [rows, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.department, filters.status, filters.riskLevel, pageSize, rows.length]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') setDrawerOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  async function openDetails(row) {
    const caseRef = row.caseId?._id || row.caseId;
    if (!caseRef) return;

    setDrawerTab('overview');
    setDrawerOpen(true);
    setDrawerLoading(true);
    setOpeningRowId(row._id);

    try {
      const { data } = await api.get(`/cases/${caseRef}`);
      const directives = data.directives || [];
      const matchedDirective = directives.find((item) => String(item._id) === String(row.directiveId))
        || directives.find((item) => item.directiveNumber === row.directiveNumber)
        || null;
      const directiveAudit = filterDirectiveAudit(data.audit || [], matchedDirective?._id || row.directiveId);

      setDrawerData({
        action: row,
        caseData: data.case,
        directive: matchedDirective,
        directives,
        audit: data.audit || [],
        directiveAudit
      });
    } catch (error) {
      notify(friendlyError(error), 'error');
      setDrawerOpen(false);
    } finally {
      setDrawerLoading(false);
      setOpeningRowId('');
    }
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  function resetFilters() {
    setFilters(defaultFilters);
  }

  const showingStart = filteredRows.length ? (page - 1) * pageSize + 1 : 0;
  const showingEnd = Math.min(page * pageSize, filteredRows.length);

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-gov">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-navy">Approved Action Register (Trusted View)</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Compact compliance register with case-level drill-down for governance review.</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
          {filteredRows.length} records
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="xl:col-span-2">
          <span className="sr-only">Search by case ID</span>
          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search by Case ID"
              className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none"
            />
          </div>
        </label>

        <select
          value={filters.department}
          onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold"
        >
          <option value="">All departments</option>
          {departmentOptions.map((item) => <option key={item}>{item}</option>)}
        </select>

        <select
          value={filters.status}
          onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold"
        >
          <option value="">All statuses</option>
          {statusOptions.map((item) => <option key={item}>{item}</option>)}
        </select>

        <select
          value={filters.riskLevel}
          onChange={(event) => setFilters((current) => ({ ...current, riskLevel: event.target.value }))}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold"
        >
          <option value="">All risk levels</option>
          {riskOptions.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
          <Filter className="h-3.5 w-3.5" />
          Case ID, Department, Status, and Risk filters applied
        </div>
        <button onClick={resetFilters} className="focus-ring rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700">
          Reset filters
        </button>
      </div>

      {filteredRows.length ? (
        <>
          <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
            <div className="max-h-[28rem] overflow-auto">
              <table className="min-w-[860px] w-full table-fixed divide-y divide-slate-200">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr>
                    <th className="table-header">Case ID</th>
                    <th className="table-header">Department</th>
                    <th className="table-header">Deadline</th>
                    <th className="table-header">Risk</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Priority</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedRows.map((row, index) => {
                    const overdue = new Date(row.deadline || 0) < new Date() && row.trackingStatus !== 'Completed';
                    return (
                      <tr key={row._id || `${row.caseId?.caseId}-${index}`} className="bg-white hover:bg-amber-50/50">
                        <td className="table-cell">
                          <span className="block max-w-[9rem] truncate font-bold text-navy" title={row.caseId?.caseId || ''}>
                            {row.caseId?.caseId || '—'}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className="block max-w-[11rem] truncate" title={row.responsibleDepartment || ''}>
                            {row.responsibleDepartment || '—'}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className={overdue ? 'font-bold text-red-700' : 'text-slate-700'} title={deadlineText(row)}>
                            {deadlineText(row)}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="inline-flex items-center gap-2">
                            <StatusBadge value={row.riskLevel} warn={row.riskLevel === 'Critical' || row.riskLevel === 'High'} />
                            <span className="text-xs font-semibold text-slate-500" title={`Risk score ${row.riskScore ?? '-'}`}>
                              {row.riskScore ?? '-'}
                            </span>
                          </div>
                        </td>
                        <td className="table-cell"><StatusBadge value={row.trackingStatus} /></td>
                        <td className="table-cell"><StatusBadge value={row.priorityLevel} /></td>
                        <td className="table-cell">
                          <button
                            onClick={() => openDetails(row)}
                            disabled={openingRowId === row._id}
                            className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-gold px-3 py-1.5 text-xs font-bold text-navy disabled:opacity-60"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {openingRowId === row._id ? 'Loading...' : 'View Details'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-slate-500">
              Showing {showingStart}-{showingEnd} of {filteredRows.length} records
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-slate-500">Rows</label>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-gold"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="focus-ring inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <span className="text-xs font-semibold text-slate-600">Page {page} / {totalPages}</span>
              <button
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="focus-ring inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-4">
          <EmptyState title="No approved actions match the selected filters" message="Try clearing one or more register filters." />
        </div>
      )}

      <TrustedActionDrawer
        open={drawerOpen}
        loading={drawerLoading}
        tab={drawerTab}
        setTab={setDrawerTab}
        data={drawerData}
        onClose={closeDrawer}
      />
    </section>
  );
}

function TrustedActionDrawer({ open, loading, tab, setTab, data, onClose }) {
  const directive = data?.directive || null;
  const action = data?.action || null;
  const caseData = data?.caseData || null;
  const directiveAudit = data?.directiveAudit || [];
  const directives = data?.directives || [];

  const verificationHistory = useMemo(() => buildVerificationHistory(directive, directiveAudit), [directive, directiveAudit]);
  const escalationNotes = useMemo(() => buildEscalationNotes(directive, directiveAudit), [directive, directiveAudit]);

  const dependencies = directive?.dependsOn || [];
  const dependentBy = useMemo(() => {
    if (!directive?._id) return [];
    return directives.filter((item) =>
      String(item._id) !== String(directive._id)
      && (item.dependsOn || []).some((dep) => String(dep._id || dep) === String(directive._id))
    );
  }, [directive, directives]);

  const lastTracking = directive?.trackingHistory?.length
    ? directive.trackingHistory[directive.trackingHistory.length - 1]
    : null;

  const timeline = [
    { label: 'Order Date', value: formatDate(caseData?.dateOfOrder), icon: Clock3 },
    { label: 'Verified On', value: formatDate(directive?.verifiedAt || action?.verifiedAt), icon: User },
    { label: 'Deadline', value: formatDate(action?.deadline), icon: Clock3 },
    {
      label: 'Last Tracking Update',
      value: lastTracking ? `${lastTracking.status} - ${formatDate(lastTracking.updatedAt)}` : 'No tracking updates yet',
      icon: History
    }
  ];

  return (
    <div className={`fixed inset-0 z-50 ${open ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!open}>
      <button
        onClick={onClose}
        className={`absolute inset-0 bg-navy/45 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
        aria-label="Close drawer"
      />
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-[960px] overflow-hidden border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gold">Trusted Record Details</p>
              <h3 className="mt-1 text-lg font-extrabold text-navy">{caseData?.caseId || action?.caseId?.caseId || 'Case Detail'}</h3>
              <p className="mt-1 text-xs text-slate-500">Directive {directive?.directiveNumber || action?.directiveNumber || '-'}</p>
            </div>
            <button onClick={onClose} className="focus-ring rounded-md border border-slate-200 p-2 text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b border-slate-200 px-4 py-2 sm:px-5">
            <div className="flex gap-2 overflow-x-auto">
              {drawerTabs.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`shrink-0 rounded-md px-3 py-2 text-xs font-bold ${tab === item.id ? 'bg-navy text-white' : 'bg-slate-100 text-slate-700'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {loading ? (
              <p className="text-sm font-semibold text-slate-600">Loading directive details...</p>
            ) : !action ? (
              <p className="text-sm font-semibold text-slate-600">Select a register row to inspect details.</p>
            ) : (
              <>
                {tab === 'overview' && (
                  <div className="space-y-4">
                    <section className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                      <InfoItem label="Case ID" value={caseData?.caseId || action.caseId?.caseId} />
                      <InfoItem label="Court" value={caseData?.courtName} />
                      <InfoItem label="Department" value={action.responsibleDepartment} />
                      <InfoItem label="Status" value={<StatusBadge value={action.trackingStatus} />} />
                      <InfoItem label="Risk" value={<StatusBadge value={action.riskLevel} warn={action.riskLevel === 'Critical' || action.riskLevel === 'High'} />} />
                      <InfoItem label="Priority" value={<StatusBadge value={action.priorityLevel} />} />
                    </section>

                    <section className="rounded-md border border-slate-200 bg-white p-4">
                      <h4 className="text-sm font-extrabold text-navy">Full Action Description</h4>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{action.actionDescription || action.directiveText || 'No action description available.'}</p>
                    </section>

                    <section className="rounded-md border border-slate-200 bg-white p-4">
                      <h4 className="text-sm font-extrabold text-navy">Full Party Details</h4>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {caseData?.petitioner || '-'} vs {caseData?.respondent || '-'}
                      </p>
                    </section>

                    <section className="rounded-md border border-slate-200 bg-white p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-navy" />
                        <h4 className="text-sm font-extrabold text-navy">Timeline Information</h4>
                      </div>
                      <div className="space-y-2">
                        {timeline.map((item) => {
                          const Icon = item.icon;
                          return (
                            <div key={item.label} className="flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2">
                              <Icon className="mt-0.5 h-4 w-4 text-slate-600" />
                              <div>
                                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
                                <p className="text-sm font-semibold text-slate-700">{item.value || 'Not available'}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    <section className="rounded-md border border-slate-200 bg-white p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <User className="h-4 w-4 text-navy" />
                        <h4 className="text-sm font-extrabold text-navy">Reviewer Information</h4>
                      </div>
                      <div className="space-y-1 text-sm text-slate-700">
                        <p><span className="font-bold text-slate-500">Reviewer:</span> {toActorLabel(directive?.verifiedBy)}</p>
                        <p><span className="font-bold text-slate-500">Verification Status:</span> {String(directive?.verificationStatus || action.verificationStatus || '-').replace(/_/g, ' ')}</p>
                        <p><span className="font-bold text-slate-500">Verified At:</span> {formatDate(directive?.verifiedAt || action.verifiedAt)}</p>
                      </div>
                    </section>

                    <section className="rounded-md border border-slate-200 bg-white p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <History className="h-4 w-4 text-navy" />
                        <h4 className="text-sm font-extrabold text-navy">Verification History</h4>
                      </div>
                      {verificationHistory.length ? (
                        <div className="space-y-2">
                          {verificationHistory.map((item) => (
                            <div key={item.key} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.action}</p>
                              <p className="mt-1 text-sm font-semibold text-slate-700">{toActorLabel(item.actor)} - {formatDate(item.at)}</p>
                              {item.details ? <p className="mt-1 text-xs text-slate-600">{item.details}</p> : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">No verification history available.</p>
                      )}
                    </section>

                    <section className="rounded-md border border-slate-200 bg-white p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-red-700" />
                        <h4 className="text-sm font-extrabold text-navy">Escalation Notes</h4>
                      </div>
                      {escalationNotes.length ? (
                        <div className="space-y-2">
                          {escalationNotes.map((item) => (
                            <div key={item.key} className="rounded-md border border-red-100 bg-red-50 px-3 py-2">
                              <p className="text-sm font-semibold text-red-800">{item.note}</p>
                              <p className="mt-1 text-xs text-red-700">{toActorLabel(item.by)} - {formatDate(item.at)}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">No escalation notes on this directive.</p>
                      )}
                    </section>
                  </div>
                )}

                {tab === 'audit' && (
                  <div className="space-y-3">
                    {directiveAudit.length ? (
                      directiveAudit.map((item) => (
                        <div key={item._id} className="rounded-md border border-slate-200 bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{String(item.action || '').replace(/_/g, ' ')}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">{toActorLabel(item.performedBy)} - {formatDate(item.performedAt)}</p>
                          {item.details?.note ? <p className="mt-2 text-sm text-slate-700">{item.details.note}</p> : null}
                          {Array.isArray(item.details?.changes) && item.details.changes.length ? (
                            <div className="mt-2 space-y-1 text-xs text-slate-600">
                              {item.details.changes.map((change, index) => (
                                <p key={`${item._id}-${index}`}>{change.field}: {change.oldValue || '""'} {'->'} {change.newValue || '""'}</p>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <EmptyState title="No directive audit entries" message="Audit logs will appear after verification or status changes." />
                    )}
                  </div>
                )}

                {tab === 'dependencies' && (
                  <div className="space-y-4">
                    <section className="rounded-md border border-slate-200 bg-white p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-navy" />
                        <h4 className="text-sm font-extrabold text-navy">Dependency Information</h4>
                      </div>
                      {dependencies.length ? (
                        <div className="space-y-2">
                          {dependencies.map((item, index) => (
                            <div key={String(item._id || index)} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                              Depends on Directive {item.directiveNumber || item}
                              {item.trackingStatus ? ` - ${item.trackingStatus}` : ''}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">No upstream dependencies configured.</p>
                      )}
                    </section>

                    <section className="rounded-md border border-slate-200 bg-white p-4">
                      <h4 className="text-sm font-extrabold text-navy">Dependent Directives</h4>
                      {dependentBy.length ? (
                        <div className="mt-2 space-y-2">
                          {dependentBy.map((item) => (
                            <div key={item._id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                              Directive {item.directiveNumber} depends on this directive ({item.trackingStatus})
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">No downstream dependencies recorded.</p>
                      )}
                    </section>
                  </div>
                )}

                {tab === 'evidence' && (
                  <div className="space-y-4">
                    <section className="rounded-md border border-slate-200 bg-white p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-navy" />
                        <h4 className="text-sm font-extrabold text-navy">Directive Text</h4>
                      </div>
                      <p className="text-sm leading-6 text-slate-700">{directive?.directiveText || action.directiveText || 'No directive text available.'}</p>
                    </section>

                    <section className="rounded-md border border-slate-200 bg-white p-4">
                      <h4 className="text-sm font-extrabold text-navy">Source Evidence</h4>
                      <p className="mt-2 whitespace-pre-wrap bg-yellow-100 px-2 py-2 text-sm leading-6 text-slate-700">
                        {directive?.sourceText || action.sourceText || 'No source evidence available.'}
                      </p>
                      <p className="mt-2 text-xs font-semibold text-slate-500">Source paragraph: {directive?.sourceParagraph || action.sourceParagraph || '-'}</p>
                    </section>

                    <section className="rounded-md border border-slate-200 bg-white p-4">
                      <h4 className="text-sm font-extrabold text-navy">Confidence Score</h4>
                      <div className="mt-2 max-w-xs">
                        <ConfidenceBar value={Number(directive?.confidenceScore ?? action.confidenceScore ?? 0)} />
                      </div>
                    </section>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 break-words text-sm font-semibold text-slate-700">{value || 'Not set'}</div>
    </div>
  );
}
