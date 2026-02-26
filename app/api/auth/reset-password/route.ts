import { NextResponse } from 'next/server';

import { createHash } from 'node:crypto';

import { hashPassword } from '@/lib/auth/password';
import { validatePassword } from '@/lib/auth/passwordPolicy';
import { prisma } from '@/lib/prisma';

// eslint-disable-next-line sonarjs/slow-regex -- standard email validation regex, bounded by @ and domain separators
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export async function POST(req: Request) {
  let body: { email?: string; token?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const rawToken = body.token?.trim();
  const newPassword = body.newPassword;

  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
  }
  if (!rawToken || !newPassword) {
    return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 });
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const identifier = `password-reset:${email}`;
  const token = hashToken(rawToken);

  const verificationToken = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier, token } },
  });

  if (!verificationToken || verificationToken.expires.getTime() <= Date.now()) {
    if (verificationToken) {
      await prisma.verificationToken.delete({
        where: { identifier_token: { identifier, token } },
      });
    }
    return NextResponse.json({ error: 'Reset link is invalid or expired' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier, token } },
    });
    return NextResponse.json({ error: 'Reset link is invalid or expired' }, { status: 400 });
  }

  const hashedPassword = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    }),
    prisma.verificationToken.deleteMany({
      where: { identifier },
    }),
  ]);

  return NextResponse.json({ success: true });
}
