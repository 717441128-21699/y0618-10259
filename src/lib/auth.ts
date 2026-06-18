import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { cookies } from 'next/headers';
import { randomBytes, createHmac } from 'crypto';

const SESSION_COOKIE = 'blog_session';
const SESSION_SECRET = process.env.NEXTAUTH_SECRET || 'default-secret';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function signSession(data: string): string {
  const signature = createHmac('sha256', SESSION_SECRET).update(data).digest('hex');
  return `${data}.${signature}`;
}

function verifySession(signed: string): string | null {
  const [data, signature] = signed.split('.');
  if (!data || !signature) return null;
  const expected = createHmac('sha256', SESSION_SECRET).update(data).digest('hex');
  if (signature !== expected) return null;
  return data;
}

export async function createSession(user: SessionUser): Promise<string> {
  const sessionData = JSON.stringify({
    userId: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin,
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  const signed = signSession(sessionData);
  cookies().set(SESSION_COOKIE, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  return signed;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookie = cookies().get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  const data = verifySession(cookie);
  if (!data) return null;
  try {
    const session = JSON.parse(data);
    if (session.expires < Date.now()) {
      cookies().delete(SESSION_COOKIE);
      return null;
    }
    return {
      id: session.userId,
      email: session.email,
      name: session.name,
      isAdmin: session.isAdmin,
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  cookies().delete(SESSION_COOKIE);
}

export async function createDefaultAdmin(): Promise<void> {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@blog.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      const passwordHash = await hashPassword(adminPassword);
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          name: '管理员',
          isAdmin: true,
        },
      });
    }
  } catch (e) {
    // 静默处理并发创建或重复创建的错误
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null && session.isAdmin;
}
