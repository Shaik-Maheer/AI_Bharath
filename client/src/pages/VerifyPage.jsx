import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Edit3, XCircle } from 'lucide-react';
import { api, friendlyError } from '../utils/api';
import { dateInputValue } from '../utils/date';
import { useToast } from '../context/ToastContext';
import { usePageTitle } from '../utils/usePageTitle';
import { publishDataUpdate } from '../utils/liveUpdates';
import TextHighlighter from '../components/TextHighlighter';
import ConfidenceBar from '../components/ConfidenceBar';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';

const departments = ['Revenue', 'Finance', 'Police', 'Legal', 'Health', 'Education', 'Public Works', 'District Administration', 'Other'];
const actionTypes = ['compliance', 'appeal', 'review'];
const priorities = ['High', 'Medium', 'Low'];
const risks = ['Critical', 'High', 'Medium', 'Low'];

function editableFrom(directive) {
  return {
    actionType: directive.actionType,
    actionDescription: directive.actionDescription,
    responsibleDepartment: directive.responsibleDepartment,
    assignedOfficer: directive.assignedOfficer,
    deadline: dateInputValue(directive.deadline),
    priorityLevel: directive.priorityLevel,
    riskLevel: directive.riskLevel,
    riskScore: directive.riskScore ?? 60,
    riskNote: directive.riskNote,
    dependsOn: (directive.dependsOn || []).map((item) => item._id || item)
  };
}

export default function VerifyPage() {
  const { caseId } = useParams();
  usePageTitle('Verification');
  const [caseData, setCaseData] = useState(null);
  const [directives, setDirectives] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const { notify } = useToast();
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get(`/cases/${caseId}`);
      setCaseData(data.case);
      setDirectives(data.directives);
      const firstPending = data.directives.find((item) => item.verificationStatus === 'pending') || data.directives[0];
      if (firstPending) {
        setSelectedId(firstPending._id);
        setForm(editableFrom(firstPending));
      }
    } catch (error) {
      notify(friendlyError(error), 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [caseId]);

  const selected = useMemo(() => directives.find((item) => item._id === selectedId), [directives, selectedId]);
  const verifiedCount = directives.filter((item) => item.verificationStatus !== 'pending').length;
  const pendingDirectives = directives.filter((item) => item.verificationStatus === 'pending');

  function selectDirective(directive) {
    setSelectedId(directive._id);
    setForm(editableFrom(directive));
  }

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleDependency(id) {
    setForm((current) => {
      const currentIds = current.dependsOn || [];
      return { ...current, dependsOn: currentIds.includes(id) ? currentIds.filter((item) => item !== id) : [...currentIds, id] };
    });
  }

  async function verify(decision) {
    if (!selected) return;
    setSaving(true);
    try {
      const updates = {
        ...form,
        deadline: form.deadline ? new Date(form.deadline) : selected.deadline,
        riskScore: form.riskScore === '' || form.riskScore === null || form.riskScore === undefined ? selected.riskScore ?? 60 : Number(form.riskScore)
      };
      await api.put(`/directives/${selected._id}/verify`, { decision, updates, reason: decision === 'edited' ? 'Reviewer confirmed field updates.' : '' });
      notify(decision === 'rejected' ? 'Directive rejected.' : 'Directive verified.');
      publishDataUpdate('directive-verified');
      setRejectTarget(null);
      await load();
    } catch (error) {
      notify(friendlyError(error), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function submitAll() {
    setSaving(true);
    try {
      await api.put(`/cases/${caseId}/submit-verified`);
      notify('Case submitted to dashboard.');
      publishDataUpdate('case-verified');
      navigate(`/cases/${caseId}`);
    } catch (error) {
      notify(friendlyError(error), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-600">Loading verification workspace...</p>;

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy">Human Verification</h1>
          <p className="mt-1 text-sm text-slate-600">{caseData?.caseTitle}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-navy">
          {verifiedCount} of {directives.length} directives verified
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[40fr_60fr]">
        <TextHighlighter text={caseData?.extractedText} activeSource={selected?.sourceText} />

        <section className="space-y-4">
          <div className="space-y-3">
            {pendingDirectives.length ? (
              pendingDirectives.map((directive) => (
                <button
                  key={directive._id}
                  onClick={() => selectDirective(directive)}
                  className={`w-full rounded-md border p-4 text-left ${selectedId === directive._id ? 'border-gold bg-amber-50' : 'border-slate-200 bg-white'}`}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <p className="font-extrabold text-navy">Directive {directive.directiveNumber}</p>
                    <ConfidenceBar value={directive.confidenceScore} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{directive.directiveText}</p>
                </button>
              ))
            ) : (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">All directives have a verification decision.</div>
            )}
          </div>

          {selected && (
            <div className="rounded-md border border-slate-200 bg-white p-5 shadow-gov">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-navy">Directive {selected.directiveNumber}</h2>
                  <p className="mt-2 bg-yellow-100 px-2 py-1 text-sm leading-6 text-slate-700">{selected.sourceText}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">Source paragraph: {selected.sourceParagraph}</p>
                </div>
                <div className="space-y-2">
                  <ConfidenceBar value={selected.confidenceScore} />
                  <StatusBadge value={selected.verificationStatus} />
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-bold text-navy">
                  Action Type
                  <select value={form.actionType || ''} onChange={(event) => setField('actionType', event.target.value)} className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 font-normal outline-none focus:border-gold">
                    {actionTypes.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="text-sm font-bold text-navy">
                  Responsible Department
                  <select value={form.responsibleDepartment || ''} onChange={(event) => setField('responsibleDepartment', event.target.value)} className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 font-normal outline-none focus:border-gold">
                    {departments.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="text-sm font-bold text-navy">
                  Deadline {selected.deadlineInferred && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Inferred</span>}
                  <input type="date" value={form.deadline || ''} onChange={(event) => setField('deadline', event.target.value)} className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 font-normal outline-none focus:border-gold" />
                </label>
                <label className="text-sm font-bold text-navy">
                  Assigned Officer
                  <input value={form.assignedOfficer || ''} onChange={(event) => setField('assignedOfficer', event.target.value)} className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 font-normal outline-none focus:border-gold" />
                </label>
                <label className="text-sm font-bold text-navy">
                  Priority
                  <select value={form.priorityLevel || ''} onChange={(event) => setField('priorityLevel', event.target.value)} className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 font-normal outline-none focus:border-gold">
                    {priorities.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="text-sm font-bold text-navy">
                  Risk Level
                  <select value={form.riskLevel || ''} onChange={(event) => setField('riskLevel', event.target.value)} className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 font-normal outline-none focus:border-gold">
                    {risks.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="text-sm font-bold text-navy">
                  Risk Score (0-100)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.riskScore ?? ''}
                    onChange={(event) => setField('riskScore', event.target.value === '' ? '' : Number(event.target.value))}
                    className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 font-normal outline-none focus:border-gold"
                  />
                </label>
              </div>

              <label className="mt-4 block text-sm font-bold text-navy">
                Action Description
                <textarea value={form.actionDescription || ''} onChange={(event) => setField('actionDescription', event.target.value)} rows={3} className="mt-2 w-full rounded-md border border-slate-200 p-3 font-normal outline-none focus:border-gold" />
              </label>
              <label className="mt-4 block text-sm font-bold text-navy">
                Risk Note
                <textarea value={form.riskNote || ''} onChange={(event) => setField('riskNote', event.target.value)} rows={2} className="mt-2 w-full rounded-md border border-slate-200 p-3 font-normal outline-none focus:border-gold" />
              </label>
              <p className="mt-2 text-xs text-slate-500">{selected.deadlineNote}</p>

              <div className="mt-4 rounded-md border border-slate-200 p-4">
                <p className="text-sm font-bold text-navy">Dependencies</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {directives.filter((item) => item._id !== selected._id).map((item) => (
                    <label key={item._id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={(form.dependsOn || []).includes(item._id)} onChange={() => toggleDependency(item._id)} />
                      Depends on Directive {item.directiveNumber}
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button onClick={() => verify('approved')} disabled={saving} className="focus-ring inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-60">
                  <CheckCircle2 className="h-5 w-5" />
                  Approve
                </button>
                <button onClick={() => verify('edited')} disabled={saving} className="focus-ring inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-3 font-bold text-white disabled:opacity-60">
                  <Edit3 className="h-5 w-5" />
                  Save Edits
                </button>
                <button onClick={() => setRejectTarget(selected)} disabled={saving} className="focus-ring inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-red-700 px-4 py-3 font-bold text-white disabled:opacity-60">
                  <XCircle className="h-5 w-5" />
                  Reject
                </button>
              </div>
            </div>
          )}

          <button onClick={submitAll} disabled={saving || directives.some((item) => item.verificationStatus === 'pending')} className="focus-ring w-full rounded-md bg-navy px-5 py-3 font-bold text-white disabled:opacity-50">
            Submit All Verified
          </button>
        </section>
      </div>

      <ConfirmModal
        open={Boolean(rejectTarget)}
        title="Reject directive"
        message={`Reject Directive ${rejectTarget?.directiveNumber}? It will be removed from the active enforcement pipeline.`}
        confirmLabel="Reject"
        onClose={() => setRejectTarget(null)}
        onConfirm={() => verify('rejected')}
        loading={saving}
      />
    </div>
  );
}
