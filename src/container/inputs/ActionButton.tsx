import React from 'react';
import './inputs.css';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
}

// Button im gleichen Stil wie ChoiceButton: volle Breite, Icon links, Kante zum Titel
const ActionButton: React.FC<ActionButtonProps> = ({ icon, children, className, type = 'button', ...rest }) => (
  <button type={type} className={`input-tile action-button ${className ?? ''}`} {...rest}>
    <span className="input-tile-lead" aria-hidden="true">{icon}</span>
    <span className="input-tile-title">{children}</span>
  </button>
);

export default ActionButton;
