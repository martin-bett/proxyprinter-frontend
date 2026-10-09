import React from 'react';
import { Github } from 'lucide-react';
import ActionLink from '../../container/inputs/ActionLink';
import { useTranslation } from 'react-i18next';

const GitHubButton: React.FC = () => {
  const { t } = useTranslation();
  return (
  <ActionLink href="https://github.com/martin-bett?tab=repositories" icon={<Github />}>
    {t('info.participate')}
  </ActionLink>
  );
};

export default GitHubButton;
