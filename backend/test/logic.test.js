import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { scoreHealth, bugPenaltyScore } from '../src/lib/health.js';
import { splitRequirement, storiesFallback, testsFallback, analysisFallback, sprintPlanFallback } from '../src/lib/ai.js';
import { extractTaskNumbers, verifySignature } from '../src/lib/github.js';

test('health score re-normalises weights when components have no data', () => {
  const h = scoreHealth([
    { key: 'a', weight: 50, score: 100 },
    { key: 'b', weight: 50, score: null },
  ]);
  assert.equal(h.score, 100);
  assert.equal(scoreHealth([{ weight: 1, score: null }]).score, null);
});

test('health labels', () => {
  assert.equal(scoreHealth([{ weight: 1, score: 85 }]).label, 'Healthy');
  assert.equal(scoreHealth([{ weight: 1, score: 65 }]).label, 'Needs attention');
  assert.equal(scoreHealth([{ weight: 1, score: 30 }]).label, 'At risk');
});

test('critical bugs hurt more than low ones, score never negative', () => {
  assert.ok(bugPenaltyScore([{ severity: 'CRITICAL' }]) < bugPenaltyScore([{ severity: 'LOW' }]));
  assert.equal(bugPenaltyScore(Array(10).fill({ severity: 'CRITICAL' })), 0);
});

test('requirement splitting strips bullets and short fragments', () => {
  const parts = splitRequirement('- Users can sign in.\n- ok\n2) Passwords are hashed; sessions expire');
  assert.deepEqual(parts, ['Users can sign in', 'Passwords are hashed', 'sessions expire']);
});

test('fallback generators return usable, valid drafts', () => {
  const req = { title: 'Login', priority: 'HIGH', description: 'The system shall let users sign in with email. Sessions expire after 7 days.' };
  const stories = storiesFallback(req).stories;
  assert.ok(stories.length >= 2);
  assert.ok(stories[0].title.startsWith('As a user, I want to let users sign in'));
  assert.ok(stories.every((s) => s.points > 0 && s.acceptanceCriteria.length));
  assert.ok(testsFallback(req).testCases.length >= 3);
});

test('requirement analysis flags vague, unmeasurable text', () => {
  const a = analysisFallback({ title: 'Reports', description: 'The system should be fast and easy.' });
  assert.ok(a.issues.length >= 2);
  assert.ok(a.clarityScore < 80);
});

test('sprint plan respects capacity and priority', () => {
  const backlog = [
    { id: 'a', priority: 'LOW', points: 3 },
    { id: 'b', priority: 'CRITICAL', points: 5 },
    { id: 'c', priority: 'HIGH', points: 5 },
  ];
  const plan = sprintPlanFallback(backlog, 8);
  assert.deepEqual(plan.taskIds, ['b', 'a']);
  assert.ok(plan.totalPoints <= 8);
});

test('git helpers: task refs and webhook signature', () => {
  assert.deepEqual(extractTaskNumbers('DEV', 'fix DEV-12 and dev-3, also OTHER-9', 'DEV-12'), [12, 3]);
  const body = Buffer.from('{"a":1}');
  const sig = 'sha256=' + crypto.createHmac('sha256', 's3cret').update(body).digest('hex');
  assert.equal(verifySignature('s3cret', body, sig), true);
  assert.equal(verifySignature('wrong', body, sig), false);
  assert.equal(verifySignature('s3cret', body, undefined), false);
});
