# DevTree — Security and performance

Notes on security measures, safe patterns, and performance considerations.

---

## 1. Authentication and authorization

- **Session:** JWT in HTTP-only cookie (NextAuth). No session storage of secrets on the client.
- **API routes:** User-scoped actions use `getToken()` from `next-auth/jwt` and `token.sub` (user id). All `/api/user/*` routes require an authenticated user inline — no token → 401 JSON.
- **Passwords:** Hashed with **scrypt** (salt + key), verified with `timingSafeEqual` to reduce timing attacks. See `lib/auth/password.ts`.

---

## 2. Input and output

- **Avatar upload:** Allowed types (JPEG, PNG, GIF, WebP) and max size (2MB) are enforced. Filename is `${userId}${ext}` (no user-controlled path). Files stored under `public/uploads/avatars/`.
- **Audio block:** URL-only — the browser fetches the media directly from the provided URL using a native `<audio>` element. No server-side upload or storage. Users are responsible for providing a valid, publicly accessible URL (MP3, OGG, WAV, M4A).
- **Diagram block:** User diagram source is rendered by **Mermaid**; we set `securityLevel: 'strict'` so script/link in labels are disabled. The SVG assigned to `innerHTML` is Mermaid-generated only, not raw user HTML.
- **Locale script (layout):** The inline script in the root layout is a fixed string (no user input). It only reads `localStorage` and `document.cookie` and sets the locale cookie then optionally reloads.

---

## 3. Environment and secrets

- **AUTH_SECRET** (or NEXTAUTH_SECRET): Required for JWT signing. Never commit; use `.env` / `.env.local` (gitignored).
- **Database:** `DATABASE_URL` must not be committed. OAuth client IDs/secrets only in env.
- See [SETUP.md](./SETUP.md) for the full list of required and optional variables.

---

## 4. Performance

- **Locale:** The root layout reads a `x-devtree-locale` request header to determine the initial SSR locale (English fallback when the header is absent). A small inline script syncs the cookie from `localStorage` and reloads once when the cookie was missing so the next request carries the correct locale.
- **Dynamic layout:** Root layout uses `export const dynamic = 'force-dynamic'` to re-evaluate locale on every request.
- **Heavy UI:** Monaco (code block) and Mermaid (diagram) are loaded dynamically where possible to keep initial bundle smaller.
- **Preferences:** Logged-in user preferences (theme, locale, feature flags) are loaded once after auth and applied; they are also persisted to the DB and cookie so refresh keeps settings.

---

## 5. Reporting issues

If you find a security concern, report it privately (e.g. via maintainer contact or a private security advisory) rather than in a public issue.
