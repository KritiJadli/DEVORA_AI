import jwt from 'jsonwebtoken';
import { prisma } from './prisma.js';
import { HttpError, wrap } from './http.js';

const SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

export const signToken = (userId) => jwt.sign({ sub: userId }, SECRET, { expiresIn: '7d' });

/** Verifies the Bearer token and attaches req.user = { id }. */
export function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Authentication required'));
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = { id: payload.sub };
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
}

/** Loads the caller's membership for :projectId. Non-members get 404 (no project enumeration). */
export const projectAccess = wrap(async (req, _res, next) => {
  const member = await prisma.member.findUnique({
    where: { projectId_userId: { projectId: req.params.projectId, userId: req.user.id } },
    include: { project: true },
  });
  if (!member) throw new HttpError(404, 'Project not found');
  req.member = member;
  req.project = member.project;
  next();
});

/** Centralised RBAC check: requireRole(perm.build) */
export const requireRole = (roles) => (req, _res, next) =>
  roles.includes(req.member.role)
    ? next()
    : next(new HttpError(403, `This action requires role: ${roles.join(' or ')}`));
