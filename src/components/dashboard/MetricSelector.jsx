import React, { useRef } from 'react';
import { cn } from "@/lib/utils";
import { Pencil } from 'lucide-react';

export default function MetricSelector({ selected, onChange, metrics, onColorChange }) {
  const defaultMetrics = [
    { key: 'fatigue', label: 'Fatigue', color: '#ef4444' },
    { key: 'intensite', label: 'Intensité', color: '#f59e0b' },
    { key: 'sommeil', label: 'Sommeil', color: '#8b5cf6' },
    { key: 'plaisir', label: 'Plaisir', color: '#10b981' },
    { key: 'harmonie_proches', label: 'Harmonie proches', color: '#06b6d4' },
    { key: 'maitrise_technique', label: 'Maîtrise technique', color: '#3b82f6' },
    { key: 'maitrise_tactique', label: 'Maîtrise tactique', color: '#6366f1' },
    { key: 'epanouissement', label: 'Épanouissement', color: '#ec4899' }
  ];

  const metricsToUse = metrics || defaultMetrics;

  const toggleMetric = (key) => {
    if (selected.includes(key)) {
      onChange(selected.filter(m => m !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {metricsToUse.map(metric => (
        <MetricButton
          key={metric.key}
          metric={metric}
          isSelected={selected.includes(metric.key)}
          onToggle={() => toggleMetric(metric.key)}
          onColorChange={onColorChange}
        />
      ))}
    </div>
  );
}

function MetricButton({ metric, isSelected, onToggle, onColorChange }) {
  const colorInputRef = useRef(null);

  const handleColorClick = (e) => {
    e.stopPropagation();
    colorInputRef.current?.click();
  };

  const handleColorChange = (e) => {
    e.stopPropagation();
    if (onColorChange) {
      onColorChange(metric.key, e.target.value);
    }
  };

  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border-2 shadow-sm",
        isSelected
          ? "text-white border-transparent shadow-md"
          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
      )}
      style={isSelected ? { backgroundColor: metric.color, borderColor: metric.color } : {}}
    >
      {/* Rond coloré avec crayon au survol */}
      <span className="relative group/dot flex items-center justify-center">
        <span
          className="w-3 h-3 rounded-full block transition-opacity group-hover/dot:opacity-0"
          style={{ backgroundColor: metric.color }}
        />
        {/* Crayon visible au survol */}
        <span
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/dot:opacity-100 cursor-pointer transition-opacity"
          onClick={handleColorClick}
          title="Changer la couleur"
        >
          <Pencil
            className="w-3 h-3"
            style={{ color: isSelected ? 'white' : metric.color }}
          />
        </span>
        {/* Input color caché */}
        <input
          ref={colorInputRef}
          type="color"
          value={metric.color}
          onChange={handleColorChange}
          onClick={(e) => e.stopPropagation()}
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
          tabIndex={-1}
        />
      </span>
      {metric.label}
    </button>
  );
}