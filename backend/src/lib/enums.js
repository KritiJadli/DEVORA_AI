export const ROLES = ['MANAGER', 'DEVELOPER', 'TESTER'];
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const REQ_STATUSES = ['DRAFT', 'APPROVED', 'IMPLEMENTED'];
export const TASK_STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
export const TASK_TYPES = ['STORY', 'TASK'];
export const BUG_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
export const TEST_STATUSES = ['NOT_RUN', 'PASSED', 'FAILED'];

/** Permission groups used by RBAC middleware (see lib/auth.js). */
export const perm = {
  manage: ['MANAGER'],
  build: ['MANAGER', 'DEVELOPER'],
  qa: ['MANAGER', 'TESTER'],
};
