import { NextResponse } from 'next/server';

import { createHash, randomBytes } from 'node:crypto';

import { sendPasswordResetEmail } from '@/lib/auth/resetEmail';
import { prisma } from '@/lib/prisma';

const TOKEN_EXPIRY_MS = 60 * 60 * 1000;
// eslint-disable-next-line sonarjs/slow-regex -- standard email validation regex, bounded by @ and domain separators
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

function getBaseUrl() {
  return (
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    process.env.VERCEL_URL?.replace(/^https?:\/\//, 'https://') ??
    'http://localhost:3000'
  );
}

export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  // Always return success to avoid account enumeration.
  if (!user) {
    return NextResponse.json({ success: true });
  }

  const rawToken = randomBytes(32).toString('hex');
  const token = hashToken(rawToken);
  const identifier = `password-reset:${email}`;
  const expires = new Date(Date.now() + TOKEN_EXPIRY_MS);

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token, expires },
  });

  const resetUrl = `${getBaseUrl().replace(/\/$/, '')}/forgot-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

  try {
    await sendPasswordResetEmail({ to: email, resetUrl });
  } catch (err) {
    console.error('[auth/forgot-password] Failed to send reset email', err);
  }

  return NextResponse.json({ success: true });
}
