import React from 'react';
import { Github } from 'lucide-react';
import ActionLink from '../../container/inputs/ActionLink';

const GitHubButton: React.FC = () => (
  <ActionLink href="https://github.com/martin-bett?tab=repositories" icon={<Github />}>
    Participate
  </ActionLink>
);

export default GitHubButton;
