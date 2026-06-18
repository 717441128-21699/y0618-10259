'use server';

import { prisma } from '@/lib/prisma';
import { verifyPassword, createSession, destroySession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export async function login(data: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    return { error: '邮箱或密码错误' };
  }

  const valid = await verifyPassword(data.password, user.passwordHash);
  if (!valid) {
    return { error: '邮箱或密码错误' };
  }

  if (!user.isAdmin) {
    return { error: '您没有管理员权限' };
  }

  await createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin,
  });

  return { success: true };
}

export async function logout() {
  await destroySession();
  redirect('/');
}
