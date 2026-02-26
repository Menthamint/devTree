import { NextResponse } from 'next/server';

import { hashPassword } from '@/lib/auth/password';
import { validatePassword } from '@/lib/auth/passwordPolicy';
import { prisma } from '@/lib/prisma';

// eslint-disable-next-line sonarjs/slow-regex -- standard email validation regex, bounded by @ and domain separators
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string; name?: string };
    const { email, password, name } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    const trimmedEmail = email.trim().toLowerCase();
    // RFC 5321 caps addresses at 254 chars; rejecting longer inputs prevents ReDoS
    if (trimmedEmail.length > 254 || !EMAIL_REGEX.test(trimmedEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: trimmedEmail } });
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 },
      );
    }

    const hashed = await hashPassword(password);
    await prisma.user.create({
      data: {
        email: trimmedEmail,
        password: hashed,
        name: name?.trim() || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
