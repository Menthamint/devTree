# DevTree — Authentication

How authentication works: NextAuth, credentials vs OAuth, session, route protection, and user profile APIs.

---

## 1. Overview

- **Protected routes:** All routes except `/login`, `/register`, `/forgot-password`, and `/api/auth/*` require a valid session. Each API route handler enforces this inline: no valid token → 401 JSON. Page routes rely on client-side session check.
- **Session:** Stored in an HTTP-only cookie as a JWT (no server-side session table). Session callback merges fresh `name` and `image` from the DB so profile updates show without re-login.
- **Providers:** Credentials (email + password, scrypt), Google OAuth, GitHub OAuth. Registration is custom (`/api/auth/register`); then user signs in via credentials.

---

## 2. NextAuth configuration

**File:** `app/api/auth/[...nextauth]/route.ts`

- **Adapter:** `PrismaAdapter(prisma)` — creates/updates User and Account for OAuth.
- **Session:** `strategy: 'jwt'`, `maxAge: 30 days`.
- **Callbacks:** `session` — loads `User.name` and `User.image` from DB by `token.sub` and merges into `session.user`.
- **Error handling:** Route wrapper returns JSON on 500 so the client never gets HTML.

---

## 3. Credentials and registration

- **Credentials authorize:** Look up User by email, verify password with `verifyPassword` (scrypt), return user payload.
- **Registration:** `POST /api/auth/register` — validate email and password strength, hash with `hashPassword`, create User. Front-end then signs in via credentials.

### Password reset

- **Request reset:** `POST /api/auth/forgot-password` with `{ email }`.
  - Validates email shape, always returns success for unknown emails (prevents account enumeration).
  - Stores a one-time token in `VerificationToken` using identifier `password-reset:<email>`.
  - Stores only a SHA-256 hash of the raw token.
  - Sends reset URL to email via Nodemailer (Gmail transport when configured).
- **Confirm reset:** `POST /api/auth/reset-password` with `{ email, token, newPassword }`.
  - Validates token + expiry and password policy.
  - Updates `User.password` with scrypt hash.
  - Deletes all reset tokens for that email (single-use guarantee).

---

## 4. OAuth (Google, GitHub)

Callback URLs: `{NEXTAUTH_URL}/api/auth/callback/google` and `/github`. PrismaAdapter creates/updates User and Account. OAuth users have `password: null`; can set password later in Settings.

---

## 5. Route protection

There is no `middleware.ts`. Instead, each API route handler protects itself by calling `getToken` from `next-auth/jwt` at the top of the handler:

```ts
const token = await getToken({ req, secret: process.env.AUTH_SECRET });
if (!token?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

- **API routes** return `401 JSON` when no valid token is found.
- **Page routes** (`/notebook`, `/statistics`, etc.) redirect to `/login?callbackUrl=...` from within the page component or are protected by the session check in `app/layout.tsx`.

---

## 6. User profile APIs

- **PATCH /api/user/profile** — Body: `{ name?, image? }`. Updates current user in DB.
- **POST /api/user/avatar** — Multipart file; saves to `public/uploads/avatars/<userId>.<ext>`, sets `User.image`, returns `{ url }`.
- **PATCH /api/user/password** — Body: `{ currentPassword, newPassword }`. Verifies current, validates new (same rules as registration), hashes and updates.
- **GET /api/user/preferences** — Returns the current user’s saved preferences (theme, locale, tagsPerPageEnabled, tagsPerBlockEnabled). Stored in `User.preferences` (JSON).
- **PATCH /api/user/preferences** — Body: `{ theme?, locale?, tagsPerPageEnabled?, tagsPerBlockEnabled? }`. Merges into stored preferences so settings follow the user across devices.

All require an authenticated user (verified inline via `getToken` in each handler).

---

## 7. Default admin

In `prisma/seed.ts`: when `ADMIN_PASSWORD` is set, upserts user with `ADMIN_EMAIL` (default `admin@localhost`) and hashed password. Run `pnpm db:seed` after setting env. See [SETUP.md](./SETUP.md) and main README for env table.

---

## 8. Password reset email configuration

- Password reset email delivery uses Nodemailer.
- For Gmail transport, set:
  - `GMAIL_USER`
  - `GMAIL_APP_PASSWORD` (Google App Password)
  - optional `EMAIL_FROM`
- When Gmail variables are missing, DevTree logs the reset link on the server in development as a fallback.
