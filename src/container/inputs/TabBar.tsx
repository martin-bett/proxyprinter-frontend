import React from 'react';
import './inputs.css';

export interface TabBarTab<K extends string> {
  key: K;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

interface TabBarProps<K extends string> {
  tabs: TabBarTab<K>[];
  active: K;
  onChange: (key: K) => void;
  // Präfix für die ids, damit aria-controls auf das passende Panel zeigt
  idPrefix: string;
}

export const tabPanelId = (idPrefix: string, key: string) => `${idPrefix}-panel-${key}`;

// Reiter im input-tile-Stil; der aktive Reiter geht nahtlos in das Panel darunter über (.tab-panel)
const TabBar = <K extends string>({ tabs, active, onChange, idPrefix }: TabBarProps<K>) => (
  <div className="tab-bar" role="tablist">
    {tabs.map(tab => (
      <button
        key={tab.key}
        type="button"
        role="tab"
        id={`${idPrefix}-tab-${tab.key}`}
        aria-selected={tab.key === active}
        aria-controls={tabPanelId(idPrefix, tab.key)}
        className={`input-tile tab-bar-tab${tab.key === active ? ' is-active' : ''}`}
        onClick={() => onChange(tab.key)}
      >
        {tab.icon && <span className="input-tile-lead" aria-hidden="true">{tab.icon}</span>}
        <span className="input-tile-title">{tab.label}</span>
      </button>
    ))}
  </div>
);

export default TabBar;
