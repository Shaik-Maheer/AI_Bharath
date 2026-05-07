import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Download, Network, ShieldAlert } from 'lucide-react';
import { api, friendlyError } from '../utils/api';
import { daysRemaining, formatDate } from '../utils/date';
import { useToast } from '../context/ToastContext';
import { usePageTitle } from '../utils/usePageTitle';
import { useAuth } from '../context/AuthContext';
import SortableTable from '../components/SortableTable';
import StatusBadge from '../components/StatusBadge';
import RiskModal from '../components/RiskModal';
import DependencyGraph from '../components/DependencyGraph';
import EmptyState from '../components/EmptyState';

const tabs = ['Overview', 'Directives', 'Audit Trail', 'Dependency Map'];

function auditChangeSummary(item) {
  const changeList = item.details?.changes;
  if (Array.isArray(changeList) && changeList.length) {
    return changeList.map((change) => `${change.field}: ${change.oldValue || '""'} -> ${change.newValue || '""'}`).join(' | ');
  }
  if (item.details?.field) {
    return `${item.details.field}: ${item.details.oldValue || '""'} -> ${item.details.newValue || '""'}`;
  }
  if (item.details?.reason) return item.details.reason;
  return '';
}

export default function CaseDetail() {
  const { caseId } = useParams();
  usePageTitle('Case Detail');
  const [caseData, setCaseData] = useState(null);
  const [directives, setDirectives] = useState([]);
  const [audit, setAudit] = useState([]);
  const [activeTab, setActiveTab] = useState('Overview');
  const [riskText, setRiskText] = useState('');
  const [auditFilter, setAuditFilter] = useState({ action: '', user: '' });
  const { notify } = useToast();
  const { user } = useAuth();

  async function load() {
    try {
      const { data } = await api.get(`/cases/${caseId}`);
      setCaseData(data.case);
      setDirectives(data.directives);
      setAudit(data.audit);
    } catch (error) {
      notify(friendlyError(error), 'error');
    }
  }

  useEffect(() => {
    load();
  }, [caseId]);

  const approved = directives.filter((item) => ['approved', 'edited'].includes(item.verificationStatus));
  const stats = {
    total: directives.length,
    approved: approved.length,
    rejected: directives.filter((item) => item.verificationStatus === 'rejected').length,
    pending: directives.filter((item) => item.verificationStatus === 'pending').length
  };

  const filteredAudit = useMemo(
    () =>
      audit.filter((item) => {
        const actionMatch = !auditFilter.action || item.action === auditFilter.action;
        const userMatch = !auditFilter.user || item.performedBy?.name?.toLowerCase().includes(auditFilter.user.toLowerCase());
        return actionMatch && userMatch;
      }),
    [audit, auditFilter]
  );

  async function updateStatus(directive, status) {
    try {
      await api.put(`/directives/${directive._id}/status`, { status, note: 'Updated from case detail view.' });
      notify('Tracking status updated.');
      load();
    } catch (error) {
      notify(friendlyError(error), 'error');
    }
  }

  async function openRisk(directive) {
    try {
      const { data } = await api.get(`/directives/${directive._id}/whatif`);
      setRiskText(data.whatIfRisk);
    } catch (error) {
      notify(friendlyError(error), 'error');
    }
  }

  function exportCsv() {
    const rows = filteredAudit.map((item) => [
      formatDate(item.performedAt),
      item.performedBy?.name || '',
      item.action,
      auditChangeSummary(item)
    ]);
    const csv = [['Timestamp', 'User', 'Action', 'Details'], ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${caseData?.caseId || 'audit'}-audit.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!caseData) return <p className="text-sm text-slate-600">Loading case details...</p>;

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-2xl font-extrabold text-navy">{caseData.caseTitle}</h1>
        <p className="mt-1 text-sm text-slate-600">{caseData.courtName} - {caseData.caseNumber}</p>
      </section>
      {user?.role === 'viewer' && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
          Viewer access: read-only trusted monitoring view. Verification and status updates are restricted to reviewer/admin roles.
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto border-b border-slate-200">
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-3 text-sm font-bold ${activeTab === tab ? 'border-b-2 border-gold text-navy' : 'text-slate-500'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-gov">
            <h2 className="text-lg font-extrabold text-navy">Case Metadata</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Meta label="Case ID" value={caseData.caseId} />
              <Meta label="Status" value={<StatusBadge value={caseData.status} />} />
              <Meta label="Petitioner" value={caseData.petitioner} />
              <Meta label="Respondent" value={caseData.respondent} />
              <Meta label="Date of Order" value={formatDate(caseData.dateOfOrder)} />
              <Meta label="Uploaded By" value={caseData.uploadedBy?.name || 'System'} />
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-gov">
            <h2 className="text-lg font-extrabold text-navy">Extraction Stats</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {Object.entries(stats).map(([key, value]) => (
                <div key={key} className="rounded-md bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">{key}</p>
                  <p className="mt-1 text-2xl font-extrabold text-navy">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'Directives' && (
        <SortableTable
          rows={approved}
          empty={<EmptyState title="No approved directives" message="Approve directives in the verification screen to activate tracking." />}
          columns={[
            { key: 'directiveNumber', label: 'No.' },
            { key: 'actionDescription', label: 'Action' },
            { key: 'responsibleDepartment', label: 'Department' },
            {
              key: 'deadline',
              label: 'Deadline',
              render: (row) => {
                const remaining = daysRemaining(row.deadline);
                const urgent = remaining < 7 && row.trackingStatus !== 'Completed';
                return (
                  <span className={`inline-flex items-center gap-1 font-bold ${urgent ? 'text-red-700' : 'text-slate-700'}`}>
                    {urgent && <AlertTriangle className="h-4 w-4" />}
                    {formatDate(row.deadline)} ({remaining < 0 ? `${Math.abs(remaining)} days overdue` : `${remaining} days remaining`})
                  </span>
                );
              }
            },
            { key: 'priorityLevel', label: 'Priority', render: (row) => <StatusBadge value={row.priorityLevel} /> },
            { key: 'riskScore', label: 'Risk Score', render: (row) => row.riskScore ?? '-' },
            {
              key: 'trackingStatus',
              label: 'Status',
              render: (row) => (
                user?.role === 'viewer' ? (
                  <StatusBadge value={row.trackingStatus} />
                ) : (
                  <select value={row.trackingStatus} onChange={(event) => updateStatus(row, event.target.value)} className="rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-gold">
                    {['Pending', 'In Progress', 'Completed', 'Escalated'].map((item) => <option key={item}>{item}</option>)}
                  </select>
                )
              )
            },
            {
              key: 'dependsOn',
              label: 'Dependency',
              render: (row) => (row.dependsOn?.length ? `Depends on: Directive ${row.dependsOn.map((item) => item.directiveNumber).join(', ')}` : 'None')
            },
            {
              key: 'whatIf',
              label: 'What-If',
              render: (row) => (
                <button onClick={() => openRisk(row)} className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700">
                  <ShieldAlert className="h-4 w-4" />
                  What-If
                </button>
              )
            }
          ]}
        />
      )}

      {activeTab === 'Audit Trail' && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-gov md:flex-row">
            <select value={auditFilter.action} onChange={(event) => setAuditFilter({ ...auditFilter, action: event.target.value })} className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold">
              <option value="">All actions</option>
              {[...new Set(audit.map((item) => item.action))].map((item) => <option key={item}>{item}</option>)}
            </select>
            <input value={auditFilter.user} onChange={(event) => setAuditFilter({ ...auditFilter, user: event.target.value })} placeholder="Filter by user" className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold" />
            <button onClick={exportCsv} className="focus-ring inline-flex items-center gap-2 rounded-md border border-gold px-4 py-2 text-sm font-bold text-navy">
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
          <SortableTable
            rows={filteredAudit}
            empty={<EmptyState title="No audit records" message="Verification and tracking changes will appear here." />}
            columns={[
              { key: 'performedAt', label: 'Timestamp', render: (row) => formatDate(row.performedAt) },
              { key: 'performedBy', label: 'User', accessor: (row) => row.performedBy?.name || 'System' },
              { key: 'action', label: 'Action', render: (row) => row.action.replace(/_/g, ' ') },
              { key: 'details', label: 'Details', render: (row) => <span className="text-xs leading-5">{auditChangeSummary(row) || '-'}</span> }
            ]}
          />
        </section>
      )}

      {activeTab === 'Dependency Map' && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Network className="h-5 w-5 text-navy" />
            <h2 className="text-lg font-extrabold text-navy">Directive Dependency Map</h2>
          </div>
          <DependencyGraph directives={approved} />
        </section>
      )}

      <RiskModal open={Boolean(riskText)} text={riskText} onClose={() => setRiskText('')} />
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <div className="mt-1 font-semibold text-slate-800">{value}</div>
    </div>
  );
}
