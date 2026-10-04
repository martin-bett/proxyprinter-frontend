import React from 'react';
import './inputs.css';

interface ActionLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  icon: React.ReactNode;
}

// Externer Link im gleichen Stil wie ActionButton, öffnet in neuem Tab
const ActionLink: React.FC<ActionLinkProps> = ({ icon, children, className, ...rest }) => (
  <a
    target="_blank"
    rel="noopener noreferrer"
    className={`input-tile action-button ${className ?? ''}`}
    {...rest}
  >
    <span className="input-tile-lead" aria-hidden="true">{icon}</span>
    <span className="input-tile-title">{children}</span>
  </a>
);

export default ActionLink;
