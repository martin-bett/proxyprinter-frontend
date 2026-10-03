import React from 'react';
import './inputs.css';

interface CategoryToggleProps {
  icon: React.ReactNode;
  title: string;
  checked: boolean;
  indeterminate?: boolean;
  onClick: () => void;
}

// Rundes Kategorie-Icon, Auswahl wird über den Rahmen gezeigt statt über einen Haken
const CategoryToggle: React.FC<CategoryToggleProps> = ({ icon, title, checked, indeterminate = false, onClick }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={indeterminate ? 'mixed' : checked}
    title={title}
    className={`category-toggle ${checked ? 'is-checked' : ''} ${indeterminate ? 'is-indeterminate' : ''}`}
    onClick={onClick}
  >
    {icon}
  </button>
);

export default CategoryToggle;
