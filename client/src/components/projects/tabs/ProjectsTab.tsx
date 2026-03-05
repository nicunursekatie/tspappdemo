import React from 'react';
import { ProjectCard } from '../cards/ProjectCard';
import { Project } from '@shared/schema';

interface ProjectsTabProps {
  projects: Project[];
  emptyMessage?: string;
}

export const ProjectsTab: React.FC<ProjectsTabProps> = ({
  projects,
  emptyMessage = 'No projects found'
}) => {
  if (projects.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500 font-roboto">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="projects-list">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
};