import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardList, FileText } from 'lucide-react';
import { api, friendlyError } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { usePageTitle } from '../utils/usePageTitle';
import { formatDate } from '../utils/date';
import { useAuth } from '../context/AuthContext';
import KpiCard from '../components/KpiCard';
import SortableTable from '../components/SortableTable';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { BarChart, DonutChart } from '../components/Charts';

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
  const { notify } = useToast();
  const { user } = useAuth();

  async function load() {
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
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  const statusData = [
    { label: 'Pending', value: summary.pending || 0 },
    { label: 'In Progress', value: summary.inProgress || 0 },
    { label: 'Completed', value: summary.completed || 0 }
  ];

  async function escalateAction(action) {
    setEscalatingId(action._id);
    try {
      await api.put(`/directives/${action._id}/status`, {
        status: 'Escalated',
        note: 'Escalated by admin from dashboard overdue monitoring.'
      });
      notify(`Directive ${action.directiveNumber} escalated.`);
      await load();
    } catch (error) {
      notify(friendlyError(error), 'error');
    } finally {
      setEscalatingId('');
    }
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
          rows={highRisk}
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
                          onClick={() => escalateAction(row)}
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
          rows={actions}
          empty={<EmptyState title="No approved actions" message="Approve directives in verification to publish them to the trusted dashboard." />}
          columns={[
            { key: 'case', label: 'Case ID', accessor: (row) => row.caseId?.caseId, render: (row) => <span className="font-bold text-navy">{row.caseId?.caseId}</span> },
            { key: 'directiveNumber', label: 'Directive' },
            { key: 'responsibleDepartment', label: 'Department' },
            { key: 'actionDescription', label: 'Action' },
            { key: 'dateOfOrder', label: 'Order Date', accessor: (row) => row.caseId?.dateOfOrder, render: (row) => formatDate(row.caseId?.dateOfOrder) },
            { key: 'verifiedAt', label: 'Verified On', render: (row) => formatDate(row.verifiedAt) },
            { key: 'deadline', label: 'Deadline', render: (row) => <span className={new Date(row.deadline) < new Date() && row.trackingStatus !== 'Completed' ? 'font-bold text-red-700' : ''}>{formatDate(row.deadline)}</span> },
            { key: 'priorityLevel', label: 'Priority', render: (row) => <StatusBadge value={row.priorityLevel} /> },
            { key: 'riskScore', label: 'Risk Score' },
            { key: 'trackingStatus', label: 'Status', render: (row) => <StatusBadge value={row.trackingStatus} /> }
          ]}
        />
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-gov">
        <h2 className="text-lg font-extrabold text-navy">Recent Activity</h2>
        <div className="mt-4 space-y-3">
          {recent.length ? (
            recent.map((item) => (
              <div key={item._id} className="flex flex-col gap-1 border-b border-slate-100 pb-3 last:border-0">
                <p className="text-sm font-semibold text-slate-800">
                  {item.performedBy?.name || 'System'} {item.action.replace(/_/g, ' ')}
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
    </div>
  );
}
