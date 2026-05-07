import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { api, friendlyError } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { usePageTitle } from '../utils/usePageTitle';
import { formatDate } from '../utils/date';
import UploadDropzone from '../components/UploadDropzone';
import StepTracker from '../components/StepTracker';
import ConfidenceBar from '../components/ConfidenceBar';
import StatusBadge from '../components/StatusBadge';

const processSteps = ['Reading PDF', 'Identifying Directives', 'Generating Action Plan'];

export default function UploadPage() {
  usePageTitle('Upload Judgment');
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [result, setResult] = useState(null);
  const { notify } = useToast();

  async function loadSample() {
    setLoadingSample(true);
    try {
      const { data } = await api.get('/cases/sample-judgment', { responseType: 'text' });
      setText(data);
      notify('Sample judgment loaded.', 'info');
    } catch (error) {
      notify(friendlyError(error), 'error');
    } finally {
      setLoadingSample(false);
    }
  }

  async function submit() {
    if (!file && !text.trim()) {
      notify('Upload a PDF or paste judgment text first.', 'error');
      return;
    }

    setLoading(true);
    setResult(null);
    setActiveStep(0);
    setUploadProgress(10);
    try {
      const formData = new FormData();
      if (file) formData.append('pdf', file);
      if (text.trim()) formData.append('text', text);

      setTimeout(() => setActiveStep(1), 500);
      setTimeout(() => setActiveStep(2), 1000);

      const { data } = await api.post('/cases/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => setUploadProgress(Math.round((event.loaded * 100) / (event.total || 1)))
      });
      setActiveStep(3);
      setUploadProgress(100);
      setResult(data);
      notify('Extraction completed. Proceed to human verification.');
    } catch (error) {
      notify(friendlyError(error), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-extrabold text-navy">Upload & Extraction</h1>
        <p className="mt-1 text-sm text-slate-600">Create a structured action plan from a judgment PDF or pasted text.</p>
      </section>

      <StepTracker steps={['Upload', 'AI Processing', 'Extraction Results']} activeIndex={result ? 2 : loading ? 1 : 0} />

      {!result && (
        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <UploadDropzone file={file} setFile={setFile} text={text} setText={setText} onSample={loadSample} loadingSample={loadingSample} />
          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-gov">
            <h2 className="text-lg font-extrabold text-navy">Processing</h2>
            <div className="mt-4 h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-gold transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
            <div className="mt-5 space-y-3">
              {processSteps.map((step, index) => (
                <div key={step} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  {loading && index === activeStep ? <span className="h-2 w-2 rounded-full bg-gold" /> : <CheckCircle2 className={`h-4 w-4 ${index < activeStep ? 'text-emerald-700' : 'text-slate-300'}`} />}
                  {step}
                </div>
              ))}
            </div>
            <button onClick={submit} disabled={loading} className="focus-ring mt-6 w-full rounded-md bg-navy px-4 py-3 font-bold text-white disabled:opacity-60">
              {loading ? 'Processing...' : 'Start Extraction'}
            </button>
          </div>
        </section>
      )}

      {result && (
        <section className="space-y-5">
          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-gov">
            <h2 className="text-lg font-extrabold text-navy">Extracted Case Details</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {['caseTitle', 'courtName', 'caseNumber', 'petitioner', 'respondent'].map((field) => (
                <div key={field}>
                  <p className="text-xs font-bold uppercase text-slate-500">{field.replace(/([A-Z])/g, ' $1')}</p>
                  <p className="mt-1 font-semibold text-slate-800">{result.case[field]}</p>
                </div>
              ))}
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Date Of Order</p>
                <p className="mt-1 font-semibold text-slate-800">{formatDate(result.case.dateOfOrder)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Directives Found</p>
                <p className="mt-1 font-semibold text-slate-800">{result.extraction?.extractionStats?.directivesFound || result.directives.length}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {result.directives.map((directive) => (
              <div key={directive._id} className="rounded-md border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-bold text-navy">Directive {directive.directiveNumber}</p>
                    <p className="mt-2 bg-yellow-100 px-2 py-1 text-sm leading-6 text-slate-700">{directive.sourceText}</p>
                    <p className="mt-3 text-xs font-semibold text-slate-600">
                      Timeline: {formatDate(directive.deadline)} {directive.deadlineInferred ? '(inferred)' : '(explicit)'} - {directive.deadlineNote}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <ConfidenceBar value={directive.confidenceScore} />
                    <StatusBadge value={directive.actionType} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Link to={`/cases/${result.case.caseId}/verify`} className="focus-ring inline-flex items-center gap-2 rounded-md bg-navy px-5 py-3 font-bold text-white">
            Proceed to Verification
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      )}
    </div>
  );
}
