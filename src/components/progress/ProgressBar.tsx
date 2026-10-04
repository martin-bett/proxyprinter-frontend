import React from 'react';
import './ProgressBar.css';

export type ProgressState = 'active' | 'done' | 'pending' | 'error';

interface ProgressBarProps {
  /** Fortschritt von 0 bis 1. */
  value: number;
  state?: ProgressState;
  /** Fortschritt unbekannt: volle Breite mit laufenden Streifen. */
  indeterminate?: boolean;
  /** Text mittig über dem Balken, z. B. "42%". */
  label?: React.ReactNode;
  /** Höhe in Pixeln, Standard 14. */
  height?: number;
  /** Abweichende Füllfarbe, Standard ist die Akzentfarbe. */
  color?: string;
  className?: string;
  title?: string;
  onClick?: () => void;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value, state = 'active', indeterminate = false, label, height, color, className, title, onClick,
}) => {
  const full = indeterminate || state === 'error';
  const width = full ? 100 : Math.max(0, Math.min(1, value)) * 100;
  const style = {
    ...(height ? { '--app-progress-height': `${height}px` } : {}),
    ...(color ? { '--app-progress-color': color } : {}),
    ...(onClick ? { cursor: 'pointer' } : {}),
  } as React.CSSProperties;

  return (
    <div
      className={`app-progress is-${state}${className ? ` ${className}` : ''}`}
      style={style}
      title={title}
      onClick={onClick}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(width)}>
      {state !== 'pending' && (
        <div className={`app-progress-fill${indeterminate ? ' is-indeterminate' : ''}`} style={{ width: `${width}%` }} />
      )}
      {label != null && <span className="app-progress-label">{label}</span>}
    </div>
  );
};

export default ProgressBar;
