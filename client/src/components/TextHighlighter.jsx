export default function TextHighlighter({ text, activeSource }) {
  const paragraphs = String(text || '').split(/\n+/).filter(Boolean);

  return (
    <div className="max-h-[72vh] overflow-auto rounded-md border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
      {paragraphs.map((paragraph, index) => {
        const active = activeSource && paragraph.includes(activeSource.replace(/^\d+\.\s*/, '').slice(0, 80));
        return (
          <p key={`${paragraph.slice(0, 20)}-${index}`} className={`mb-3 rounded-sm px-2 py-1 ${active ? 'bg-yellow-100 ring-1 ring-yellow-300' : ''}`}>
            <span className="mr-2 font-bold text-slate-400">{index + 1}</span>
            {paragraph}
          </p>
        );
      })}
    </div>
  );
}

