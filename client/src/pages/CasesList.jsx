import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileUp, Trash2 } from 'lucide-react';
import { api, friendlyError } from '../utils/api';
import { formatDate } from '../utils/date';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePageTitle } from '../utils/usePageTitle';
import SortableTable from '../components/SortableTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';

export default function CasesList() {
  usePageTitle('Cases');
  const [cases, setCases] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', startDate: '', endDate: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/cases', { params: filters });
      setCases(data.cases);
    } catch (error) {
      notify(friendlyError(error), 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function removeCase() {
    try {
      await api.delete(`/cases/${deleteTarget.caseId}`);
      notify('Case deleted.');
      setDeleteTarget(null);
      load();
    } catch (error) {
      notify(friendlyError(error), 'error');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy">Cases</h1>
          <p className="mt-1 text-sm text-slate-600">Judgment uploads, extraction state, and verification entry points.</p>
        </div>
        <Link to="/cases/upload" className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-navy px-4 py-2.5 text-sm font-bold text-white">
          <FileUp className="h-4 w-4" />
          Upload New Judgment
        </Link>
      </div>

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-gov">
        <div className="grid gap-3 md:grid-cols-5">
          <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search title or number" className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold md:col-span-2" />
          <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold">
            <option value="">All statuses</option>
            <option value="pending_verification">Pending verification</option>
            <option value="verified">Verified</option>
            <option value="active">Active</option>
          </select>
          <input type="date" value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold" />
          <button onClick={load} disabled={loading} className="focus-ring rounded-md border border-gold px-4 py-2 text-sm font-bold text-navy disabled:opacity-60">
            {loading ? 'Loading...' : 'Apply Filters'}
          </button>
        </div>
      </section>

      <SortableTable
        rows={cases}
        onRowClick={(row) => navigate(`/cases/${row.caseId}`)}
        empty={<EmptyState title="No cases found" message="Upload a court judgment or change the filters." />}
        columns={[
          { key: 'caseId', label: 'Case ID', render: (row) => <span className="font-bold text-navy">{row.caseId}</span> },
          { key: 'caseTitle', label: 'Case Title' },
          { key: 'courtName', label: 'Court' },
          { key: 'dateOfOrder', label: 'Date of Order', render: (row) => formatDate(row.dateOfOrder) },
          { key: 'actionsCount', label: 'Actions Count' },
          { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
          { key: 'uploadedBy', label: 'Uploaded By', accessor: (row) => row.uploadedBy?.name || 'System' },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                {row.status === 'pending_verification' && (
                  <Link to={`/cases/${row.caseId}/verify`} className="rounded-md border border-gold px-3 py-1.5 text-xs font-bold text-navy">
                    Verify
                  </Link>
                )}
                {user?.role === 'admin' && (
                  <button onClick={() => setDeleteTarget(row)} className="rounded-md border border-red-200 p-1.5 text-red-700" title="Delete case">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            )
          }
        ]}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete case"
        message={`Delete ${deleteTarget?.caseId}? This removes its directives and audit records.`}
        confirmLabel="Delete"
        onClose={() => setDeleteTarget(null)}
        onConfirm={removeCase}
      />
    </div>
  );
}

