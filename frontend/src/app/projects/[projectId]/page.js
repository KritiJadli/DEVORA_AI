'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, LayoutDashboard, FileText, KanbanSquare, Repeat, Bug, FlaskConical, BookOpen, GitBranch, Users } from 'lucide-react';
import Shell from '@/components/Shell';
import { Badge, ErrorBox, Loading } from '@/components/ui';
import { useFetch } from '@/lib/hooks';
import { ProjectCtx } from '@/components/project/context';
import Overview from '@/components/project/Overview';
import Requirements from '@/components/project/Requirements';
import Board from '@/components/project/Board';
import Sprints from '@/components/project/Sprints';
import Bugs from '@/components/project/Bugs';
import Tests from '@/components/project/Tests';
import Docs from '@/components/project/Docs';
import DevOps from '@/components/project/DevOps';
import Team from '@/components/project/Team';

const TABS = [
  ['overview', 'Overview', LayoutDashboard, Overview],
  ['requirements', 'Requirements', FileText, Requirements],
  ['board', 'Board', KanbanSquare, Board],
  ['sprints', 'Sprints', Repeat, Sprints],
  ['bugs', 'Bugs', Bug, Bugs],
  ['tests', 'Tests', FlaskConical, Tests],
  ['docs', 'Docs', BookOpen, Docs],
  ['devops', 'Git & CI/CD', GitBranch, DevOps],
  ['team', 'Team', Users, Team],
];

export default function ProjectPage() {
  const { projectId } = useParams();
  const { data: project, loading, error, reload } = useFetch(`/projects/${projectId}`);
  const [tab, setTab] = useState('overview');

  return (
    <Shell>
      {loading ? <Loading /> : error ? (
        <div className="space-y-3"><ErrorBox message={error} /><Link href="/dashboard" className="btn-ghost inline-flex">Back to projects</Link></div>
      ) : (
        <ProjectCtx.Provider value={{ project, role: project.role, members: project.members, reload, goTo: setTab }}>
          <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Projects</Link>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-white">{project.name}</h1>
            <span className="badge bg-slate-800 text-slate-300">{project.key}</span>
            <Badge value={project.role} />
          </div>
          <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-800">
            {TABS.map(([id, name, Icon]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition ${tab === id ? 'border-brand-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                <Icon className="h-4 w-4" />{name}
              </button>
            ))}
          </nav>
          {TABS.map(([id, , , Comp]) => id === tab && <Comp key={id} />)}
        </ProjectCtx.Provider>
      )}
    </Shell>
  );
}
