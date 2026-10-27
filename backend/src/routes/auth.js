import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { HttpError, validate, wrap } from '../lib/http.js';
import { authenticate, signToken } from '../lib/auth.js';

const r = Router();
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

r.post('/register', validate(z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
})), wrap(async (req, res) => {
  const { name, email, password } = req.body;
  if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, 'Email is already registered');
  const user = await prisma.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 10) } });
  res.status(201).json({ user: publicUser(user), token: signToken(user.id) });
}));

r.post('/login', validate(z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
})), wrap(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash)))
    throw new HttpError(401, 'Invalid email or password');
  res.json({ user: publicUser(user), token: signToken(user.id) });
}));

r.get('/me', authenticate, wrap(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) throw new HttpError(401, 'User no longer exists');
  res.json({ user: publicUser(user) });
}));

export default r;
