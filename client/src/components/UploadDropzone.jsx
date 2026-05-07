import { FileUp } from 'lucide-react';

export default function UploadDropzone({ file, setFile, text, setText, onSample, loadingSample }) {
  function onDrop(event) {
    event.preventDefault();
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  return (
    <div className="space-y-5">
      <label
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-white p-10 text-center hover:border-gold"
      >
        <FileUp className="h-10 w-10 text-navy" />
        <p className="mt-3 text-lg font-extrabold text-navy">{file ? file.name : 'Drop judgment PDF here'}</p>
        <p className="mt-1 text-sm text-slate-500">PDF only, maximum 10MB</p>
        <input type="file" accept="application/pdf" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} />
      </label>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <label className="text-sm font-bold text-navy">Paste judgment text</label>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={10}
          className="mt-2 w-full rounded-md border border-slate-200 p-3 text-sm outline-none focus:border-gold"
          placeholder="Paste the judgment text for demo extraction..."
        />
        <button onClick={onSample} disabled={loadingSample} className="focus-ring mt-3 rounded-md border border-gold px-4 py-2 text-sm font-bold text-navy disabled:opacity-60">
          {loadingSample ? 'Loading sample...' : 'Use Sample Judgment'}
        </button>
      </div>
    </div>
  );
}

