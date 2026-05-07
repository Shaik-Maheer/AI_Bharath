function colorFor(status, overdue) {
  if (overdue) return '#DC2626';
  if (status === 'Completed') return '#059669';
  if (status === 'In Progress') return '#2563EB';
  return '#94A3B8';
}

export default function DependencyGraph({ directives }) {
  const width = Math.max(760, directives.length * 180);
  const height = 260;
  const positions = directives.map((directive, index) => ({ id: directive._id, x: 50 + index * 170, y: index % 2 ? 140 : 50, directive }));

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white p-4">
      <svg width={width} height={height} role="img" aria-label="Directive dependency map">
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#64748B" />
          </marker>
        </defs>
        {positions.flatMap((node) =>
          (node.directive.dependsOn || []).map((dependency) => {
            const source = positions.find((item) => item.id === (dependency._id || dependency));
            if (!source) return null;
            return <line key={`${source.id}-${node.id}`} x1={source.x + 130} y1={source.y + 35} x2={node.x} y2={node.y + 35} stroke="#64748B" strokeWidth="2" markerEnd="url(#arrow)" />;
          })
        )}
        {positions.map((node) => {
          const overdue = new Date(node.directive.deadline) < new Date() && node.directive.trackingStatus !== 'Completed';
          return (
            <g key={node.id}>
              <rect x={node.x} y={node.y} width="135" height="72" rx="6" fill="white" stroke={colorFor(node.directive.trackingStatus, overdue)} strokeWidth="3" />
              <text x={node.x + 12} y={node.y + 24} fontSize="13" fontWeight="700" fill="#0A1931">
                Directive {node.directive.directiveNumber}
              </text>
              <text x={node.x + 12} y={node.y + 48} fontSize="12" fill="#475569">
                {node.directive.trackingStatus}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

