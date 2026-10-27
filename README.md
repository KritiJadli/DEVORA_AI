# DEVORA — AI-Powered SDLC Management Platform

One workspace for the whole software lifecycle: **requirements → sprints → Kanban → bugs → tests → docs → Git → CI/CD → analytics**, with AI that drafts user stories, test cases, sprint plans and project summaries.

Built to the project synopsis: **Next.js + Tailwind** (frontend) · **Node.js + Express** (backend) · **PostgreSQL + Prisma** (database) · **OpenAI API** (AI) · **GitHub / GitHub Actions** · **Docker** · **AWS-ready**.

---

## Quick start

### Option A — Docker (one command)
```bash
docker compose up --build
# in another terminal, load demo data:
docker compose exec backend node prisma/seed.js
```
Open **http://localhost:3000** — API on http://localhost:4000/api.

### Option B — local development
Requires Node 20+ and PostgreSQL 14+.
```bash
# 1. database (or use your own Postgres)
docker run -d --name devora-db -p 5432:5432 -e POSTGRES_USER=devora -e POSTGRES_PASSWORD=devora -e POSTGRES_DB=devora postgres:16-alpine

# 2. backend
cd backend
cp .env.example .env            # edit JWT_SECRET, optionally OPENAI_API_KEY
npm install
npx prisma db push              # creates all tables
npm run seed                    # demo data (optional)
npm run dev                     # http://localhost:4000

# 3. frontend (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev                     # http://localhost:3000
```

### Demo accounts (after seeding) — password `Password@123`
| Email | Role |
|---|---|
| manager@devora.dev | Manager |
| dev@devora.dev | Developer |
| tester@devora.dev | Tester |

Log in as each one to see the **role-based dashboards** and permissions change.

---

## Features ↔ synopsis objectives

| Synopsis objective | Where it lives |
|---|---|
| End-to-end SDLC platform | Project workspace with 9 tabs (Overview, Requirements, Board, Sprints, Bugs, Tests, Docs, Git & CI/CD, Team) |
| AI requirement analysis & sprint planning | `Requirements → Analyze`, `Sprints → AI sprint plan` |
| Role-based dashboards | Overview adapts to Manager / Developer / Tester; RBAC enforced server-side |
| Git + CI/CD + issue tracking in one workspace | GitHub commits/PRs, task linking via `KEY-n`, GitHub Actions runs, webhook receiver |
| Kanban + sprint management | Drag-and-drop board, backlog, start/complete sprint with carry-over |
| Centralised documentation & collaboration | Docs tab, activity feed, team management |
| AI user stories, test cases, project summaries | `/ai/*` endpoints + review-and-accept UI |
| Analytics for progress, productivity, health | Burndown, velocity, bug severity, workload, composite **health score** |

### AI design (maps to the synopsis risk table)
- **Human in the loop** — AI output is a *draft*. Nothing is saved until the user ticks items and presses *Accept*.
- **Validation** — every LLM response is parsed with zod; invalid output is rejected. Sprint plans are re-checked (real ids only, capacity enforced).
- **Graceful degradation** — no API key, timeout or bad output ⇒ deterministic rule-based fallback, clearly labelled. Core features never depend on the LLM.
- **Structured prompts** — JSON-mode responses with a fixed schema; the model is told to use only supplied data.

### Git / CI/CD
1. *Team → GitHub integration*: set owner, repo and (for private repos) a token. The token is stored server-side and never returned by the API.
2. In GitHub → Settings → Webhooks add the **Payload URL** and **Secret** shown there (events: push, pull_request, workflow_run). Requests are verified with HMAC-SHA256.
3. Mention a task in a commit, branch or PR title, e.g. `DEV-6 add RBAC middleware`:
   - commit → task moves `TODO → IN_PROGRESS`, activity logged
   - PR opened → `IN_REVIEW`, PR link attached · PR merged → `DONE`
   - workflow runs appear in the CI/CD table and feed the health score

### Role permissions
| Capability | Manager | Developer | Tester |
|---|:-:|:-:|:-:|
| Sprints, members, project settings | ✅ | | |
| Requirements, AI user stories | ✅ | ✅ | |
| Tasks & Kanban | ✅ | ✅ | |
| Test cases, AI test generation | ✅ | | ✅ |
| Bugs, docs | ✅ | ✅ | ✅ |
| View everything | ✅ | ✅ | ✅ |

Defined once in `backend/src/lib/enums.js` (`perm`) and applied via `requireRole()` middleware. Non-members receive 404 for a project (no enumeration), and every referenced id is checked to belong to the same project.

---

## Architecture
```
Next.js (React, Tailwind, Recharts)        ← Presentation layer
        │  REST + JWT
Express API  ── auth · RBAC · zod validation · rate limiting · helmet
   ├─ routes/        auth, projects, requirements, tasks, sprints, bugs, docs, testcases, ai, integrations, webhooks
   ├─ lib/ai.js      LLM + deterministic fallback          ← AI layer
   ├─ lib/github.js  GitHub REST + webhook verification    ← Integration layer
   └─ lib/analytics  burndown, velocity, health score
        │  Prisma
PostgreSQL  (User, Project, Member, Requirement, Sprint, Task, Bug, Doc, TestCase, Activity, PipelineRun)
```

```
devora/
├─ backend/   prisma/schema.prisma · prisma/seed.js · src/ · test/ · scripts/smoke.mjs
├─ frontend/  src/app (pages) · src/components/project (one file per tab) · src/lib
├─ docker-compose.yml
└─ .github/workflows/ci.yml   (tests + build + docker build)
```

## API overview (all under `/api`, JWT `Authorization: Bearer …`)
| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` · `GET /auth/me` |
| Projects | `GET/POST /projects` · `GET/PATCH/DELETE /projects/:id` · `POST/PATCH/DELETE /projects/:id/members` · `GET …/activity` · `GET …/analytics` |
| Work items | `…/requirements` · `…/tasks` · `…/sprints` (+ `/:id/start`, `/:id/complete`) · `…/bugs` · `…/docs` · `…/test-cases` |
| AI | `POST …/ai/analyze-requirement` · `…/ai/user-stories` (+`/accept`) · `…/ai/test-cases` (+`/accept`) · `…/ai/sprint-plan` (+`/apply`) · `…/ai/summary` |
| DevOps | `GET …/integrations/git/commits` · `…/git/pulls` · `…/ci/runs` · `POST …/ci/sync` · `POST /webhooks/github/:projectId` |

## Testing
```bash
cd backend
npm test            # unit tests: health score, AI fallbacks, sprint-plan capacity, webhook HMAC, KEY-n parsing
npm run dev &       # then, with a database running:
npm run smoke       # 20-step end-to-end API test incl. RBAC checks
```
CI (`.github/workflows/ci.yml`) runs schema push, unit tests, the smoke test, frontend build and both Docker builds against a Postgres service.

## Deploying to AWS
- **Database:** Amazon RDS for PostgreSQL → set `DATABASE_URL`.
- **Containers:** push `backend` and `frontend` images to ECR; run on ECS Fargate (or a single EC2 with `docker compose`). Put an ALB in front.
- **Config:** store `JWT_SECRET`, `OPENAI_API_KEY`, `DATABASE_URL` in Secrets Manager/SSM; set `CORS_ORIGIN` to the frontend URL and rebuild the frontend with `NEXT_PUBLIC_API_URL`.
- Extend `ci.yml` with a deploy job (ECR push + `aws ecs update-service`) once AWS credentials are added as GitHub secrets.

## Environment variables
| Backend | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | **Required in production** |
| `CORS_ORIGIN` | Allowed frontend origin(s), comma-separated |
| `OPENAI_API_KEY` / `OPENAI_MODEL` / `OPENAI_BASE_URL` | Optional LLM (any OpenAI-compatible API) |

Frontend: `NEXT_PUBLIC_API_URL` (default `http://localhost:4000/api`).

## Known limitations / next steps
- No email verification or password reset; no real-time sync (board refreshes on action — WebSockets would be the next step).
- GitHub integration uses a personal access token per project; a GitHub App/OAuth flow would be the production-grade upgrade.
- Schema is applied with `prisma db push`; switch to `prisma migrate` for versioned migrations before real production use.
