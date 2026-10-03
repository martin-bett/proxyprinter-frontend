import React from 'react';
import { Github } from 'lucide-react';

const GitHubButton = () => {
  return (
    <a
      href="https://github.com/martin-bett?tab=repositories"
      target="_blank"
      rel="noopener noreferrer"
      className="button inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200 shadow-lg hover:shadow-xl"
    >
      <Github size={20} />
      <span className="font-semibold">Participate Git</span>
    </a>
  );
};

export default GitHubButton;