import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardList, Download, FileText, Search } from 'lucide-react';
import { api, friendlyError } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { usePageTitle } from '../utils/usePageTitle';
import { formatDate } from '../utils/date';
import { useAuth } from '../context/AuthContext';
import { publishDataUpdate, subscribeDataUpdates } from '../utils/liveUpdates';
import KpiCard from '../components/KpiCard';
import SortableTable from '../components/SortableTable';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import CaseReadOnlyModal from '../components/CaseReadOnlyModal';
import { BarChart, DonutChart } from '../components/Charts';

function isOverdueAction(action) {
  return action.deadline && new Date(action.deadline) < new Date() && action.trackingStatus !== 'Completed';
}

function isHighRiskAction(action) {
  return (
    action.priorityLevel === 'High' ||
    action.riskLevel === 'Critical' ||
    action.riskLevel === 'High' ||
    Number(action.riskScore || 0) >= 75 ||
    isOverdueAction(action)
  );
}

function toCsvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function displayActor(item) {
  return item.performedBy?.name || 'System';
}

function normalize(value) {
  return String(value || '').toLowerCase();
}

function matchesViewerQuery(action, searchTerm) {
  if (!searchTerm) return true;
  const text = [
    action.caseId?.caseId,
    action.directiveText,
    action.actionDescription,
    action.directiveNumber,
    action.responsibleDepartment,
    action.caseId?.petitioner,
    action.caseId?.respondent
  ]
    .map(normalize)
    .join(' ');
  return text.includes(searchTerm);
}

function matchesViewerFilters(action, filters) {
  if (filters.department && action.responsibleDepartment !== filters.department) return false;
  if (filters.riskLevel && action.riskLevel !== filters.riskLevel) return false;
  if (filters.trackingStatus && action.trackingStatus !== filters.trackingStatus) return false;

  if (filters.deadline) {
    if (!action.deadline) return false;
    const actionDeadline = new Date(action.deadline);
    const selected = new Date(filters.deadline);
    selected.setHours(23, 59, 59, 999);
    if (actionDeadline > selected) return false;
  }

  return true;
}

export default function Dashboard() {
  usePageTitle('Dashboard');
  const [summary, setSummary] = useState({});
  const [department, setDepartment] = useState([]);
  const [highRisk, setHighRisk] = useState([]);
  const [actions, setActions] = useState([]);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [recent, setRecent] = useState([]);
  const [escalatingId, setEscalatingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewerSearch, setViewerSearch] = useState('');
  const [viewerFilters, setViewerFilters] = useState({
    department: '',
    riskLevel: '',
    trackingStatus: '',
    deadline: ''
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalCase, setModalCase] = useState(null);
  const [modalDirectives, setModalDirectives] = useState([]);
  const [modalAudit, setModalAudit] = useState([]);
  const { notify } = useToast();
  const { user } = useAuth();

  const load = useCallback(async () => {
    try {
      const [summaryRes, departmentRes, highRiskRes, actionsRes, queueRes, recentRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/dashboard/department'),
        api.get('/dashboard/high-risk'),
        api.get('/dashboard/actions'),
        api.get('/dashboard/verification-queue'),
        api.get('/dashboard/recent')
      ]);
      setSummary(summaryRes.data);
      setDepartment(departmentRes.data.breakdown);
      setHighRisk(highRiskRes.data.actions);
      setActions(actionsRes.data.actions);
      setReviewQueue(queueRes.data.queue || []);
      setRecent(recentRes.data.audit);
    } catch (error) {
      notify(friendlyError(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    let active = true;
    const loadSafely = () => {
      if (!active) return;
      load();
    };

    const onFocus = () => loadSafely();
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadSafely();
    };
    const unsubscribe = subscribeDataUpdates(() => loadSafely());

    loadSafely();
    const id = setInterval(loadSafely, 15000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      active = false;
      clearInterval(id);
      unsubscribe();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const statusData = [
    { label: 'Pending', value: summary.pending || 0 },
    { label: 'In Progress', value: summary.inProgress || 0 },
    { label: 'Completed', value: summary.completed || 0 }
  ];

  const departmentOptions = useMemo(
    () => [...new Set(actions.map((item) => item.responsibleDepartment).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [actions]
  );

  const viewerFilteredActions = useMemo(() => {
    const searchTerm = normalize(viewerSearch.trim());
    return actions.filter((action) => matchesViewerQuery(action, searchTerm) && matchesViewerFilters(action, viewerFilters));
  }, [actions, viewerSearch, viewerFilters]);

  const viewerHighRiskRows = useMemo(
    () => [...viewerFilteredActions.filter((item) => isHighRiskAction(item))].sort((a, b) => new Date(a.deadline || 0) - new Date(b.deadline || 0)),
    [viewerFilteredActions]
  );

  const viewerNotifications = useMemo(() => {
    const overdue = viewerFilteredActions.filter((item) => isOverdueAction(item));
    const escalated = viewerFilteredActions.filter((item) => item.trackingStatus === 'Escalated');
    return {
      highRisk: viewerHighRiskRows,
      overdue,
      escalated
    };
  }, [viewerFilteredActions, viewerHighRiskRows]);

  const trustedRows = user?.role === 'viewer' ? viewerFilteredActions : actions;
  const highRiskRows = user?.role === 'viewer' ? viewerHighRiskRows : highRisk;

  async function escalateAction(action) {
    setEscalatingId(action._id);
    try {
      await api.put(`/directives/${action._id}/status`, {
        status: 'Escalated',
        note: 'Escalated by admin from dashboard overdue monitoring.'
      });
      notify(`Directive ${action.directiveNumber} escalated.`);
      publishDataUpdate('action-escalated');
      await load();
    } catch (error) {
      notify(friendlyError(error), 'error');
    } finally {
      setEscalatingId('');
    }
  }

  async function openCaseDetails(action) {
    const caseRef = action.caseId?._id || action.caseId;
    if (!caseRef) return;

    setModalOpen(true);
    setModalLoading(true);
    try {
      const { data } = await api.get(`/cases/${caseRef}`);
      setModalCase(data.case);
      setModalDirectives(data.directives || []);
      setModalAudit(data.audit || []);
    } catch (error) {
      notify(friendlyError(error), 'error');
      setModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  }

  function closeModal() {
    setModalOpen(false);
  }

  function resetViewerFilters() {
    setViewerSearch('');
    setViewerFilters({
      department: '',
      riskLevel: '',
      trackingStatus: '',
      deadline: ''
    });
  }

  function exportViewerCsv() {
    const rows = trustedRows.map((row) => [
      row.caseId?.caseId || '',
      row.responsibleDepartment || '',
      `Directive ${row.directiveNumber}: ${row.actionDescription || row.directiveText || ''}`,
      formatDate(row.deadline),
      row.riskScore ?? '',
      row.trackingStatus || ''
    ]);

    const csv = [['Case ID', 'Department', 'Directive', 'Deadline', 'Risk Score', 'Status'], ...rows]
      .map((line) => line.map(toCsvCell).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `approved-actions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportViewerPdf() {
    if (!trustedRows.length) {
      notify('No approved rows available for export.', 'error');
      return;
    }

    const htmlRows = trustedRows
      .map(
        (row) => `
          <tr>
            <td>${row.caseId?.caseId || ''}</td>
            <td>${row.responsibleDepartment || ''}</td>
            <td>Directive ${row.directiveNumber}: ${row.actionDescription || row.directiveText || ''}</td>
            <td>${formatDate(row.deadline)}</td>
            <td>${row.riskScore ?? ''}</td>
            <td>${row.trackingStatus || ''}</td>
          </tr>
        `
      )
      .join('');

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      notify('Please allow pop-ups to export PDF.', 'error');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Approved Action Dashboard Export</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          p { color: #475569; margin-top: 0; margin-bottom: 16px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
          th { background: #f1f5f9; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>AdhikarLoop Trusted Dashboard Export</h1>
        <p>Generated on ${formatDate(new Date())}. Use Print dialog and choose Save as PDF.</p>
        <table>
          <thead>
            <tr>
              <th>Case ID</th>
              <th>Department</th>
              <th>Directive</th>
              <th>Deadline</th>
              <th>Risk Score</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${htmlRows}</tbody>
        </table>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-extrabold text-navy">Action Assurance Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Verified court-directed actions requiring departmental tracking and closure.</p>
      </section>
      {user?.role === 'viewer' && (
        <section className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
          Viewer mode: trusted read-only dashboard. Verification, edits, and escalation actions are hidden.
        </section>
      )}
      {user?.role === 'reviewer' && (
        <section className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          Reviewer mode: process pending verification queue to move records from pending verification to approved workflow.
        </section>
      )}
      {user?.role === 'admin' && (
        <section className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-navy shadow-gov">
          Admin mode: governance and oversight. Use escalation controls for overdue actions and User Admin for role/department governance.
        </section>
      )}

      {user?.role === 'viewer' && (
        <section className="space-y-4 rounded-md border border-slate-200 bg-white p-4 shadow-gov">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-500" />
            <h2 className="text-base font-extrabold text-navy">Search, Filters, and Export (Approved Records)</h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <input
              value={viewerSearch}
              onChange={(event) => setViewerSearch(event.target.value)}
              placeholder="Search case/directive/department/party"
              className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold xl:col-span-2"
            />
            <select
              value={viewerFilters.department}
              onChange={(event) => setViewerFilters((prev) => ({ ...prev, department: event.target.value }))}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold"
            >
              <option value="">All departments</option>
              {departmentOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select
              value={viewerFilters.riskLevel}
              onChange={(event) => setViewerFilters((prev) => ({ ...prev, riskLevel: event.target.value }))}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold"
            >
              <option value="">All risk levels</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <select
              value={viewerFilters.trackingStatus}
              onChange={(event) => setViewerFilters((prev) => ({ ...prev, trackingStatus: event.target.value }))}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold"
            >
              <option value="">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Escalated">Escalated</option>
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Deadline on or before</span>
              <input
                type="date"
                value={viewerFilters.deadline}
                onChange={(event) => setViewerFilters((prev) => ({ ...prev, deadline: event.target.value }))}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold"
              />
            </label>
            <button onClick={resetViewerFilters} className="focus-ring rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">
              Reset Filters
            </button>
            <button onClick={exportViewerCsv} className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-gold px-4 py-2 text-sm font-bold text-navy">
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button onClick={exportViewerPdf} className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-bold text-white">
              <Download className="h-4 w-4" />
              Export PDF
            </button>
          </div>

          <p className="text-xs font-semibold text-slate-500">Showing {trustedRows.length} approved action records based on current viewer filters.</p>
        </section>
      )}

      {user?.role === 'viewer' && (
        <section className="grid gap-4 xl:grid-cols-3">
          <NotificationCard
            title="High-Risk Actions"
            tone="red"
            count={viewerNotifications.highRisk.length}
            rows={viewerNotifications.highRisk}
            formatter={(row) => `${row.caseId?.caseId} • D${row.directiveNumber} • ${row.responsibleDepartment}`}
          />
          <NotificationCard
            title="Overdue Actions"
            tone="amber"
            count={viewerNotifications.overdue.length}
            rows={viewerNotifications.overdue}
            formatter={(row) => `${row.caseId?.caseId} • Due ${formatDate(row.deadline)} • ${row.trackingStatus}`}
          />
          <NotificationCard
            title="Escalated Actions"
            tone="slate"
            count={viewerNotifications.escalated.length}
            rows={viewerNotifications.escalated}
            formatter={(row) => `${row.caseId?.caseId} • D${row.directiveNumber} • ${row.responsibleDepartment}`}
          />
        </section>
      )}

      {user?.role === 'reviewer' && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-navy">Reviewer Verification Queue</h2>
            <Link to="/review-queue" className="rounded-md border border-gold px-3 py-1.5 text-xs font-bold text-navy">Open Full Queue</Link>
          </div>
          <SortableTable
            rows={reviewQueue}
            empty={<EmptyState title="No pending verification cases" message="All extractions are currently verified or active." />}
            columns={[
              { key: 'caseId', label: 'Case ID', render: (row) => <span className="font-bold text-navy">{row.caseId}</span> },
              { key: 'caseTitle', label: 'Case Title' },
              { key: 'pendingDirectives', label: 'Pending Directives' },
              {
                key: 'action',
                label: 'Action',
                render: (row) => <Link to={`/cases/${row.caseId}/verify`} className="rounded-md border border-gold px-3 py-1.5 text-xs font-bold text-navy">Verify Now</Link>
              }
            ]}
          />
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Active Cases" value={summary.activeCases} icon={FileText} />
        <KpiCard label="Total Actions" value={summary.totalActions} icon={ClipboardList} tone="gold" />
        <KpiCard label="Pending Actions" value={summary.pending} icon={CheckCircle2} />
        <KpiCard label="Overdue Actions" value={summary.overdue} icon={AlertTriangle} tone="red" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-gov">
          <h2 className="text-lg font-extrabold text-navy">Actions by Status</h2>
          <div className="mt-4">{loading ? 'Loading chart...' : <DonutChart data={statusData} />}</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-gov">
          <h2 className="text-lg font-extrabold text-navy">Actions by Department</h2>
          <div className="mt-4">{loading ? 'Loading chart...' : <BarChart data={department.map((item) => ({ label: item.department, value: item.count }))} />}</div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-extrabold text-navy">High Risk Actions</h2>
        <SortableTable
          rows={highRiskRows}
          onRowClick={user?.role === 'viewer' ? openCaseDetails : undefined}
          empty={<EmptyState title="No high risk actions" message="No verified action is currently overdue or marked high risk." />}
          columns={[
            { key: 'case', label: 'Case', accessor: (row) => row.caseId?.caseId, render: (row) => <span className="font-bold text-navy">{row.caseId?.caseId}</span> },
            { key: 'directiveNumber', label: 'Directive' },
            { key: 'department', label: 'Department', accessor: 'responsibleDepartment' },
            { key: 'deadline', label: 'Deadline', render: (row) => <span className={new Date(row.deadline) < new Date() ? 'font-bold text-red-700' : ''}>{formatDate(row.deadline)}</span> },
            { key: 'riskLevel', label: 'Risk', render: (row) => <StatusBadge value={row.riskLevel} warn /> },
            { key: 'riskScore', label: 'Risk Score' },
            { key: 'trackingStatus', label: 'Status', render: (row) => <StatusBadge value={row.trackingStatus} /> },
            ...(user?.role === 'admin'
              ? [
                  {
                    key: 'escalate',
                    label: 'Escalate',
                    render: (row) => (
                      row.trackingStatus === 'Completed' || row.trackingStatus === 'Escalated' ? (
                        <span className="text-xs font-bold text-slate-500">Not Needed</span>
                      ) : (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            escalateAction(row);
                          }}
                          disabled={escalatingId === row._id}
                          className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 disabled:opacity-50"
                        >
                          {escalatingId === row._id ? 'Escalating...' : 'Escalate'}
                        </button>
                      )
                    )
                  }
                ]
              : [])
          ]}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-extrabold text-navy">Approved Action Register (Trusted View)</h2>
        <SortableTable
          rows={trustedRows}
          onRowClick={user?.role === 'viewer' ? openCaseDetails : undefined}
          empty={<EmptyState title="No approved actions" message="Approve directives in verification to publish them to the trusted dashboard." />}
          columns={[
            { key: 'case', label: 'Case ID', accessor: (row) => row.caseId?.caseId, render: (row) => <span className="font-bold text-navy">{row.caseId?.caseId}</span> },
            { key: 'directiveNumber', label: 'Directive' },
            { key: 'responsibleDepartment', label: 'Department' },
            { key: 'actionDescription', label: 'Action' },
            { key: 'party', label: 'Party', render: (row) => `${row.caseId?.petitioner || '-'} vs ${row.caseId?.respondent || '-'}` },
            { key: 'dateOfOrder', label: 'Order Date', accessor: (row) => row.caseId?.dateOfOrder, render: (row) => formatDate(row.caseId?.dateOfOrder) },
            { key: 'verifiedAt', label: 'Verified On', render: (row) => formatDate(row.verifiedAt) },
            { key: 'deadline', label: 'Deadline', render: (row) => <span className={new Date(row.deadline) < new Date() && row.trackingStatus !== 'Completed' ? 'font-bold text-red-700' : ''}>{formatDate(row.deadline)}</span> },
            { key: 'priorityLevel', label: 'Priority', render: (row) => <StatusBadge value={row.priorityLevel} /> },
            { key: 'riskScore', label: 'Risk Score' },
            { key: 'trackingStatus', label: 'Status', render: (row) => <StatusBadge value={row.trackingStatus} /> }
          ]}
        />
        {user?.role === 'viewer' && (
          <p className="mt-2 text-xs font-semibold text-slate-500">Click a case row to view detailed read-only evidence and audit activity.</p>
        )}
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-gov">
        <h2 className="text-lg font-extrabold text-navy">Recent Activity</h2>
        <div className="mt-4 space-y-3">
          {recent.length ? (
            recent.map((item) => (
              <div key={item._id} className="flex flex-col gap-1 border-b border-slate-100 pb-3 last:border-0">
                <p className="text-sm font-semibold text-slate-800">
                  {displayActor(item)} {item.action.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-slate-500">
                  {item.caseId?.caseId || 'Case'} {item.directiveId ? `- Directive ${item.directiveId.directiveNumber}` : ''} - {formatDate(item.performedAt)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No audit activity yet.</p>
          )}
        </div>
      </section>

      <CaseReadOnlyModal
        open={modalOpen}
        onClose={closeModal}
        loading={modalLoading}
        caseData={modalCase}
        directives={modalDirectives}
        audit={modalAudit}
      />
    </div>
  );
}

function NotificationCard({ title, tone, count, rows, formatter }) {
  const toneClasses = {
    red: 'border-red-200 bg-red-50',
    amber: 'border-amber-200 bg-amber-50',
    slate: 'border-slate-200 bg-slate-50'
  };

  return (
    <div className={`rounded-md border p-4 ${toneClasses[tone] || toneClasses.slate}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-navy">{title}</h3>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-navy">{count}</span>
      </div>
      <div className="mt-3 space-y-2">
        {rows.length ? (
          rows.slice(0, 4).map((item) => (
            <p key={item._id} className="rounded bg-white px-2 py-1.5 text-xs font-semibold text-slate-700">
              {formatter(item)}
            </p>
          ))
        ) : (
          <p className="text-xs font-semibold text-slate-500">No records in this category.</p>
        )}
      </div>
    </div>
  );
}
