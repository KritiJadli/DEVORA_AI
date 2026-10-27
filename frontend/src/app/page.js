import Link from 'next/link';
import { Sparkles, KanbanSquare, GitBranch, ShieldCheck, BarChart3, Bug } from 'lucide-react';

const features = [
  [Sparkles, 'AI planning', 'Turn requirements into user stories, test cases and sprint plans — you review before anything is saved.'],
  [KanbanSquare, 'Sprints & Kanban', 'Drag-and-drop boards, backlog, sprint start/complete with automatic carry-over.'],
  [Bug, 'Bug tracking', 'Severity, status and assignee tracking tied to tasks and test cases.'],
  [GitBranch, 'Git & CI/CD', 'Commits and pull requests linked to tasks; GitHub Actions status in one view.'],
  [ShieldCheck, 'Role-based access', 'Manager, Developer and Tester roles enforced on the server.'],
  [BarChart3, 'Project health', 'Burndown, velocity, workload and a single health score.'],
];

export default function Landing() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-20 text-center">
      <span className="badge bg-brand-700/40 text-brand-400">AI-powered SDLC management</span>
      <h1 className="mt-5 text-5xl font-bold tracking-tight text-white sm:text-6xl">
        From idea to deployment,<br /><span className="text-brand-400">in one workspace.</span>
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
        DEVORA unifies requirements, sprints, bugs, docs, Git and CI/CD — and uses AI to remove the repetitive planning work.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/register" className="btn-primary px-5 py-2.5">Get started</Link>
        <Link href="/login" className="btn-ghost px-5 py-2.5">Sign in</Link>
      </div>
      <div className="mt-16 grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
        {features.map(([Icon, t, d]) => (
          <div key={t} className="card">
            <Icon className="h-5 w-5 text-brand-400" />
            <h3 className="mt-3 font-semibold text-white">{t}</h3>
            <p className="mt-1 text-sm text-slate-400">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
