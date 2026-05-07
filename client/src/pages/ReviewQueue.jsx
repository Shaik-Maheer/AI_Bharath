import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { api, friendlyError } from '../utils/api';
import { formatDate } from '../utils/date';
import { useToast } from '../context/ToastContext';
import { usePageTitle } from '../utils/usePageTitle';
import { subscribeDataUpdates } from '../utils/liveUpdates';
import SortableTable from '../components/SortableTable';
import EmptyState from '../components/EmptyState';

export default function ReviewQueue() {
  usePageTitle('Review Queue');
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const { notify } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/dashboard/verification-queue');
      setQueue(data.queue || []);
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

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-2xl font-extrabold text-navy">Reviewer Verification Queue</h1>
        <p className="mt-1 text-sm text-slate-600">Only reviewer role can approve, edit, or reject extracted directives.</p>
      </section>

      {loading ? (
        <p className="text-sm text-slate-600">Loading verification queue...</p>
      ) : (
        <SortableTable
          rows={queue}
          empty={<EmptyState title="No pending verification cases" message="All extracted cases are currently verified or active." />}
          columns={[
            { key: 'caseId', label: 'Case ID', render: (row) => <span className="font-bold text-navy">{row.caseId}</span> },
            { key: 'caseTitle', label: 'Case Title' },
            { key: 'courtName', label: 'Court' },
            { key: 'dateOfOrder', label: 'Date of Order', render: (row) => formatDate(row.dateOfOrder) },
            { key: 'pendingDirectives', label: 'Pending Directives' },
            { key: 'approvedDirectives', label: 'Approved/Edited' },
            {
              key: 'actions',
              label: 'Action',
              render: (row) => (
                <Link to={`/cases/${row.caseId}/verify`} className="inline-flex items-center gap-2 rounded-md border border-gold px-3 py-1.5 text-xs font-bold text-navy">
                  <ClipboardCheck className="h-4 w-4" />
                  Open Verification
                </Link>
              )
            }
          ]}
        />
      )}
    </div>
  );
}
