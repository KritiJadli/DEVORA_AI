import { z } from 'zod';

/**
 * AI layer. Uses an OpenAI-compatible chat API when OPENAI_API_KEY is set; otherwise (or on any
 * failure) falls back to deterministic rule-based suggestions so the platform keeps working.
 * Every response carries `source` ('openai' | 'fallback') and is validated with zod before it
 * reaches the user, who must still review/accept it (human-in-the-loop).
 */
const MODEL = () => process.env.OPENAI_MODEL || 'gpt-4o-mini';
const PRIORITY_RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

async function chatJSON(system, user) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch(`${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL(),
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${system}\nRespond with a single valid JSON object only.` },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`LLM request failed (${res.status})`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

async function run(schema, system, user, fallback) {
  try {
    const raw = await chatJSON(system, user);
    if (raw) return { ...schema.parse(raw), source: 'openai' };
    return { ...fallback(), source: 'fallback' };
  } catch (e) {
    console.error('AI error:', e.message);
    return { ...fallback(), source: 'fallback', warning: 'AI service unavailable or returned invalid output — showing rule-based suggestions instead.' };
  }
}

const pri = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).catch('MEDIUM');
const reqText = (r) => `Title: ${r.title}\nPriority: ${r.priority}\nDescription:\n${r.description || '(none)'}`;

// ---------------------------------------------------------------- helpers (also unit-tested)
export function splitRequirement(text) {
  return (text || '')
    .split(/\n|;|(?<=[.!?])\s+/)
    .map((s) => s.replace(/^[\s\-*•\d.)]+/, '').replace(/[.]+$/, '').trim())
    .filter((s) => s.length > 8);
}
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const estimate = (s) => (s.length < 50 ? 2 : s.length < 110 ? 3 : 5);

// ---------------------------------------------------------------- user stories
const storiesSchema = z.object({
  stories: z.array(z.object({
    title: z.string().min(3),
    description: z.string().default(''),
    acceptanceCriteria: z.array(z.string()).default([]),
    points: z.number().int().min(1).max(21).catch(3),
    priority: pri,
  })).min(1).max(12),
});

export function storiesFallback(req, count = 5) {
  const parts = splitRequirement(req.description).slice(0, count);
  const fragments = parts.length ? parts : [req.title];
  return {
    stories: fragments.map((f) => {
      const goal = lowerFirst(f.replace(/^the system (shall|should|must|will|can)\s+/i, ''));
      return {
        title: `As a user, I want to ${goal}`,
        description: `Derived from requirement "${req.title}".\nSo that the requirement is satisfied end-to-end.`,
        acceptanceCriteria: [
          `Given a signed-in user, when they ${goal}, then the outcome is visible and persisted.`,
          'Given invalid input, then a clear validation message is shown and nothing is saved.',
        ],
        points: estimate(f),
        priority: req.priority,
      };
    }),
  };
}

export const generateUserStories = (req, count = 5) =>
  run(storiesSchema,
    `You are a senior business analyst. Convert a software requirement into ${count} or fewer INVEST-compliant user stories ("As a <role>, I want <goal> so that <benefit>"). JSON shape: {"stories":[{"title","description","acceptanceCriteria":[Given/When/Then strings],"points":1-21 Fibonacci estimate,"priority":"LOW|MEDIUM|HIGH|CRITICAL"}]}. Do not invent features absent from the requirement.`,
    reqText(req), () => storiesFallback(req, count));

// ---------------------------------------------------------------- test cases
const testsSchema = z.object({
  testCases: z.array(z.object({
    title: z.string().min(3),
    steps: z.string().default(''),
    expected: z.string().default(''),
  })).min(1).max(15),
});

export function testsFallback(req) {
  const t = req.title;
  return {
    testCases: [
      { title: `${t} — happy path`, steps: '1. Sign in with a valid account.\n2. Perform the main flow with valid data.', expected: 'The flow completes and the result is saved and displayed.' },
      { title: `${t} — invalid input`, steps: '1. Open the feature.\n2. Submit empty or malformed data.', expected: 'Validation errors are shown; no data is persisted.' },
      { title: `${t} — boundary values`, steps: '1. Use minimum and maximum allowed values/lengths.', expected: 'Boundary values are accepted; values beyond them are rejected.' },
      { title: `${t} — unauthorised access`, steps: '1. Attempt the action with a role that lacks permission.', expected: 'The action is rejected with a 403 and no data changes.' },
    ],
  };
}

export const generateTestCases = (req) =>
  run(testsSchema,
    `You are a QA engineer. Produce thorough test cases (happy path, negative, boundary, permission) for the requirement. JSON shape: {"testCases":[{"title","steps":"numbered steps","expected"}]}.`,
    reqText(req), () => testsFallback(req));

// ---------------------------------------------------------------- requirement analysis
const analysisSchema = z.object({
  clarityScore: z.number().min(0).max(100),
  issues: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
});

const VAGUE = ['fast', 'quick', 'quickly', 'easy', 'user-friendly', 'simple', 'etc', 'appropriate', 'as needed', 'some', 'good', 'robust', 'flexible'];

export function analysisFallback(req) {
  const issues = [];
  const suggestions = [];
  const text = `${req.title} ${req.description || ''}`.toLowerCase();
  if ((req.description || '').length < 40) { issues.push('Description is very brief.'); suggestions.push('Describe the actor, the action and the expected outcome.'); }
  const vague = VAGUE.filter((w) => new RegExp(`\\b${w}\\b`).test(text));
  if (vague.length) { issues.push(`Vague wording: ${vague.join(', ')}.`); suggestions.push('Replace subjective terms with measurable criteria (e.g. "responds in under 2 seconds").'); }
  if (!/\d/.test(text)) { issues.push('No measurable values or limits.'); suggestions.push('Add numbers: limits, timings, counts or sizes.'); }
  if (!/(user|admin|manager|developer|tester|customer|system)/.test(text)) { issues.push('No clear actor.'); suggestions.push('State who performs or benefits from this requirement.'); }
  return { clarityScore: Math.max(20, 100 - issues.length * 20), issues, suggestions };
}

export const analyzeRequirement = (req) =>
  run(analysisSchema,
    `You are a requirements reviewer. Assess clarity, testability and completeness. JSON shape: {"clarityScore":0-100,"issues":[string],"suggestions":[string]}.`,
    reqText(req), () => analysisFallback(req));

// ---------------------------------------------------------------- sprint planning
export function sprintPlanFallback(backlog, capacity) {
  const sorted = [...backlog].sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || (a.points ?? 3) - (b.points ?? 3));
  const taskIds = [];
  let total = 0;
  for (const t of sorted) {
    const p = t.points ?? 3;
    if (total + p <= capacity) { taskIds.push(t.id); total += p; }
  }
  return { taskIds, totalPoints: total, rationale: 'Highest-priority items were selected first, then smaller items, until the sprint capacity was filled.' };
}

export async function planSprint(backlog, capacity) {
  const ids = new Set(backlog.map((t) => t.id));
  const schema = z.object({ taskIds: z.array(z.string()), rationale: z.string().default('') });
  const result = await run(schema,
    `You are an agile coach planning a sprint. Choose backlog items for a sprint of capacity ${capacity} story points. Prefer higher priority, respect dependencies implied by titles, keep the sprint goal coherent, never exceed capacity. JSON shape: {"taskIds":[ids in suggested order],"rationale":string}.`,
    JSON.stringify(backlog.map((t) => ({ id: t.id, title: t.title, priority: t.priority, points: t.points ?? 3 }))),
    () => sprintPlanFallback(backlog, capacity));
  // never trust model output: keep only real ids and enforce capacity
  const valid = (result.taskIds || []).filter((id) => ids.has(id));
  let total = 0;
  const kept = [];
  for (const id of valid) {
    const p = backlog.find((t) => t.id === id).points ?? 3;
    if (total + p <= capacity) { kept.push(id); total += p; }
  }
  return { ...result, taskIds: kept, totalPoints: total };
}

// ---------------------------------------------------------------- project summary
export function summaryFallback(name, a) {
  const lines = [];
  lines.push(a.sprint
    ? `Sprint "${a.sprint.name}" is ${a.sprint.donePoints}/${a.sprint.totalPoints} points complete (${a.sprint.doneCount}/${a.sprint.taskCount} tasks).`
    : 'There is no active sprint.');
  lines.push(`${a.bugs.open} open bug(s)${a.bugs.bySeverity.CRITICAL ? `, including ${a.bugs.bySeverity.CRITICAL} critical` : ''}.`);
  lines.push(a.ci.successRate !== null ? `CI success rate over recent runs is ${a.ci.successRate}%.` : 'No CI runs recorded yet.');
  lines.push(a.tests.passRate !== null ? `Test pass rate is ${a.tests.passRate}% (${a.tests.failed} failing).` : 'No test results recorded yet.');
  lines.push(`Overall health: ${a.health.label}${a.health.score !== null ? ` (${a.health.score}/100)` : ''}.`);
  return { summary: `Project ${name}: ${lines.join(' ')}` };
}

export const summarizeProject = (name, analytics) =>
  run(z.object({ summary: z.string().min(10) }),
    `You are a project manager writing a concise (max 120 words) status report for a software team. Mention progress, risks and the most important next action. Use only the supplied data. JSON shape: {"summary":string}.`,
    JSON.stringify({ project: name, ...analytics, sprint: analytics.sprint && { ...analytics.sprint, burndown: undefined } }),
    () => summaryFallback(name, analytics));
