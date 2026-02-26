import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { validatePassword } from '@/lib/auth/passwordPolicy';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const currentPassword =
    typeof body.currentPassword === 'string' ? body.currentPassword : undefined;
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : undefined;
  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: 'Current password and new password are required' },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: token.sub },
    select: { password: true },
  });
  if (!user?.password) {
    return NextResponse.json(
      { error: 'Account uses OAuth; set a password in your provider' },
      { status: 400 },
    );
  }

  const valid = await verifyPassword(currentPassword, user.password);
  if (!valid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
  }

  const err = validatePassword(newPassword);
  if (err) {
    return NextResponse.json({ error: err }, { status: 400 });
  }

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: token.sub },
    data: { password: hashed },
  });

  return NextResponse.json({ success: true });
}
