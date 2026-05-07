import { X } from 'lucide-react';
import { formatDate } from '../utils/date';
import StatusBadge from './StatusBadge';

function Meta({ label, value }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

export default function CaseReadOnlyModal({ open, onClose, loading, caseData, directives, audit }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy/50 p-4">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-md bg-white p-5 shadow-gov">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-navy">Case Detail (Read-Only)</h2>
            <p className="mt-1 text-sm text-slate-600">Trusted view for governance monitoring.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-100" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-slate-600">Loading case details...</p>
        ) : caseData ? (
          <div className="mt-5 space-y-5">
            <section className="grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
              <Meta label="Case ID" value={caseData.caseId} />
              <Meta label="Date of Order" value={formatDate(caseData.dateOfOrder)} />
              <Meta label="Court" value={caseData.courtName} />
              <Meta label="Petitioner" value={caseData.petitioner} />
              <Meta label="Respondent" value={caseData.respondent} />
              <Meta label="Status" value={String(caseData.status || '').replace(/_/g, ' ')} />
            </section>

            <section>
              <h3 className="mb-3 text-lg font-extrabold text-navy">Directives and Evidence</h3>
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="table-header">No.</th>
                      <th className="table-header">Directive</th>
                      <th className="table-header">Source Evidence</th>
                      <th className="table-header">Verification</th>
                      <th className="table-header">Department</th>
                      <th className="table-header">Deadline</th>
                      <th className="table-header">Risk</th>
                      <th className="table-header">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(directives || []).map((directive) => (
                      <tr key={directive._id}>
                        <td className="table-cell font-semibold">{directive.directiveNumber}</td>
                        <td className="table-cell">
                          <p className="font-semibold text-slate-800">{directive.directiveText}</p>
                          <p className="mt-1 text-xs text-slate-500">{directive.actionDescription}</p>
                        </td>
                        <td className="table-cell text-xs leading-5 text-slate-700">{directive.sourceText}</td>
                        <td className="table-cell"><StatusBadge value={directive.verificationStatus} /></td>
                        <td className="table-cell">{directive.responsibleDepartment}</td>
                        <td className="table-cell">{formatDate(directive.deadline)}</td>
                        <td className="table-cell">{directive.riskScore}</td>
                        <td className="table-cell"><StatusBadge value={directive.trackingStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-lg font-extrabold text-navy">Audit Activity</h3>
              <div className="space-y-2 rounded-md border border-slate-200 bg-white p-4">
                {(audit || []).length ? (
                  audit.map((item) => (
                    <div key={item._id} className="border-b border-slate-100 pb-2 text-sm last:border-0">
                      <p className="font-semibold text-slate-800">
                        {item.performedBy?.name || 'System'} {String(item.action || '').replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-slate-500">{formatDate(item.performedAt)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No audit records available.</p>
                )}
              </div>
            </section>
          </div>
        ) : (
          <p className="mt-6 text-sm text-slate-600">Case details unavailable.</p>
        )}
      </div>
    </div>
  );
}

