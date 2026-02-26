# DevTree — Tech Stack (Detailed)

This document describes every major library and technology used in the project: what it does, why it was chosen, which versions we use, and how we use it in the codebase. Use it for onboarding, upgrades, or when evaluating alternatives.

---

## Table of Contents

1. [Runtime & language](#1-runtime--language)
2. [Framework & UI](#2-framework--ui)
3. [Styling & theming](#3-styling--theming)
4. [UI primitives & icons](#4-ui-primitives--icons)
5. [Editor & blocks](#5-editor--blocks)
6. [Auth & database](#6-auth--database)
7. [State & persistence](#7-state--persistence)
8. [Testing & quality](#8-testing--quality)
9. [Build & deploy](#9-build--deploy)

---

## 1. Runtime & language

### Node.js 20+

- **What:** JavaScript runtime used to run Next.js and all tooling.
- **Why:** LTS, required by Next.js 16 and modern ESM/tooling.
- **Where:** `package.json` engines (if set), CI, and local dev.

### TypeScript 5

- **What:** Typed superset of JavaScript; compiles to JS.
- **Why:** Catches bugs at compile time, enables better refactors and editor support.
- **Where:** `tsconfig.json`, all `.ts`/`.tsx` files. Strict mode enabled.
- **Key usage:** Block content discriminated unions (`BlockContent`), tree types (`TreeRoot`, `TreeNode`), API request/response types.

### pnpm 9

- **What:** Package manager; alternative to npm/yarn.
- **Why:** Fast installs, disk-efficient store, strict dependency resolution (no phantom deps).
- **Where:** `package.json` has `"packageManager": "pnpm@9.15.0"`. Use `pnpm install`, `pnpm run <script>`.

---

## 2. Framework & UI

### Next.js 16 (App Router)

- **What:** React framework with file-based routing, server components, API routes, and built-in optimizations.
- **Why:** App Router is the recommended model; RSC and Route Handlers fit auth and API needs; Turbopack speeds up dev.
- **Versions:** `next@16.x` (see `package.json`).
- **Where:**
  - `app/` — routes: `layout.tsx`, `page.tsx`, `login/`, `register/`, `forgot-password/`, `notebook/` (main SPA by query param), `statistics/`, `p/[pageId]/` (short redirect), `pages/[pageId]/` (legacy redirect), `api/auth/`, `api/user/`, `api/pages/`, `api/folders/`, `api/block/`, `api/stats/`.
  - `app/layout.tsx` — root layout, fonts (Geist), `Providers`, `globals.css`.
  - Auth is enforced inline in each API route via `getToken` from `next-auth/jwt` (no middleware file).
- **Key concepts:** Client components (`'use client'`) for interactivity; server components by default; `next/navigation` for `useRouter`, `useSearchParams`.

### React 19

- **What:** UI library; components, hooks, concurrent features.
- **Why:** Current major version; required by Next.js 16.
- **Where:** All `.tsx` components. Hooks used: `useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`, `useId`.
- **Key patterns:** Lifted state in `Workspace`; controlled inputs; no class components.

---

## 3. Styling & theming

### Tailwind CSS 4

- **What:** Utility-first CSS framework; classes like `flex`, `rounded-lg`, `bg-background`.
- **Why:** No separate CSS files for components; design tokens via `@theme` in `globals.css`; dark mode via `.dark` class.
- **Where:**
  - `app/globals.css` — `@import 'tailwindcss'`, `@theme inline { ... }`, `@source` for content scan, `@layer base`, Tiptap/ProseMirror styles.
  - All components use Tailwind classes only (no custom CSS classes for layout/theme).
- **Tailwind v4 specifics:** Configuration lives in CSS (`@theme`, `@source`). No `tailwind.config.js`. PostCSS via `@tailwindcss/postcss`. Color tokens (e.g. `--color-background`) mapped in `@theme` from CSS variables (`--background`).

### next-themes

- **What:** Theme provider for light/dark/system; persists to `localStorage`; applies class on `<html>`.
- **Why:** Avoids flash of wrong theme; respects system preference when “system” is selected.
- **Where:** `components/providers.tsx` wraps app with `ThemeProvider`. `useTheme()` in `SettingsDialog`, `UserMenu`. Class strategy: `class="dark"` on `<html>` so Tailwind `dark:` variants apply.

### tw-animate-css

- **What:** Animation utilities for Tailwind (e.g. `animate-in`, `fade-out-0`).
- **Where:** `globals.css` imports it; used in Radix UI data attributes (`data-[state=open]:animate-in`).

---

## 4. UI primitives & icons

### Radix UI

- **What:** Unstyled, accessible component primitives (Dialog, Dropdown Menu, etc.).
- **Why:** Accessibility (focus, keyboard, ARIA) out of the box; we style with Tailwind.
- **Where:**
  - `components/ui/dialog.tsx` — Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription (used by SettingsDialog, DeleteConfirmDialog).
  - `@radix-ui/react-dropdown-menu` — UserMenu dropdown.
  - `components/ui/tree-view.tsx` — FileExplorer tree.
  - `components/ui/alert-dialog.tsx` — Delete confirmation.
  - `components/ui/Switch.tsx` — Toggle in Settings.
- **Pattern:** Radix exposes `asChild`, so we pass our styled button/div; Radix handles open/close and focus.

### Lucide React

- **What:** SVG icon set (e.g. `Menu`, `Save`, `User`, `Settings`).
- **Why:** Consistent look, tree-shakeable, React-friendly.
- **Where:** Imported per component, e.g. `import { User, Palette, SlidersHorizontal } from 'lucide-react'` in SettingsDialog; `LogOut`, `Settings` in UserMenu.

---

## 5. Editor & blocks

### Tiptap 3 (ProseMirror)

- **What:** Headless rich-text editor built on ProseMirror.
- **Why:** Extensible (custom nodes, marks), good DX; we use it for the “text” block.
- **Where:** `components/features/editor/PageEditor.tsx` and `extensions/` (e.g. `extensions/CodeBlockNode.tsx`). Extensions: StarterKit, placeholder, link, etc. Global editor styles in `globals.css` (Tiptap/ProseMirror section).
- **Data:** Content stored as HTML string in block `content`.

### Monaco Editor (@monaco-editor/react)

- **What:** VS Code’s editor engine; syntax highlighting, multi-language.
- **Why:** Best-in-class code editing in the browser.
- **Where:** `components/features/editor/extensions/CodeBlockNode.tsx`. Theme synced with app theme (`vs` / `vs-dark`) via `useTheme().resolvedTheme`.

### @excalidraw/excalidraw 0.18

- **What:** Infinite-canvas visual editor with hand-drawn aesthetic (shapes, arrows, text, freehand, images, Mermaid insert).
- **Why:** Replaces the previous code-only Mermaid integration; gives users a graphical diagramming experience without requiring Mermaid syntax knowledge. Native Mermaid insert is still available via the "Mermaid diagram" button.
- **Where:** `components/features/editor/extensions/CanvasNode.tsx`. Diagram state (elements + appState) is serialised to JSON and stored per-block in the node's attributes. Library items sync cross-device via `/api/user/libraries`.
- **Coordinate fix:** Excalidraw caches `offsetLeft`/`offsetTop` for pointer math. An `onPointerDownCapture` handler on the wrapper div calls `refresh()` before each interaction so the coordinates are always correct even when lazy-loaded content above the block shifts it after mount.

### Native HTML5 Drag & Drop

- **What:** Browser-native `draggable` / `dragover` / `drop` events — no external DnD library.
- **Why:** The only DnD surface is the file/folder tree; native drag API is sufficient and keeps the bundle lighter.
- **Where:** `components/shared/ui/tree-view.tsx` — `draggable` prop per row, `onDocumentDrag` callback on the tree root, internal `draggedItem` state for highlighting drop targets.

### Recharts 3

- **What:** Composable chart library built on D3 and SVG.
- **Why:** Paired with React; responsive containers, good TypeScript types.
- **Where:** `components/features/Statistics/` — `DailyActivityChart` (bar chart), `TopicsBarChart`, `ContentTypeDonut` (pie chart). All charts wrapped in `<ResponsiveContainer>` for fluid sizing.

### react-activity-calendar

- **What:** GitHub-style activity heatmap calendar component.
- **Why:** Provides the daily activity heat-map in the Statistics section without hand-rolling it.
- **Where:** `components/features/Statistics/ActivityHeatmap.tsx` — consumes the `/api/stats/activity` endpoint.

---

## 6. Auth & database

### NextAuth v5 (Auth.js)

- **What:** Authentication for Next.js: credentials, OAuth (Google, GitHub), JWT sessions, callbacks.
- **Why:** Standard solution; supports both email/password and OAuth; JWT works well with serverless (no DB hit per request for session).
- **Where:**
  - `app/api/auth/[...nextauth]/route.ts` — NextAuth config: providers (Credentials, Google, GitHub), PrismaAdapter, JWT strategy, session callback (merge DB name/image), pages (signIn: `/login`), error wrapper (JSON 500).
  - `app/login/page.tsx` — Login/register form, validation, password strength, OAuth buttons.
  - `app/api/auth/register/route.ts` — Registration (email, password rules, Prisma create).
  - No middleware file — each API route handler calls `getToken({ req, secret })` directly so protection is co-located with the handler.
- **Session:** JWT stored in cookie; session callback reads `User.name` and `User.image` from DB so profile updates show without re-login.
- **Env:** `AUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_*`, `GITHUB_*`.

### Prisma 6

- **What:** Type-safe ORM for PostgreSQL (schema, migrations, client, seed).
- **Why:** Type-safe queries; migrations; works with NextAuth adapter and custom APIs.
- **Where:**
  - `prisma/schema.prisma` — Models: User, Account, Session, Page, Block (and relations). Datasource `postgresql`, `env("DATABASE_URL")`.
  - `lib/prisma.ts` — Singleton `PrismaClient` (avoid multiple instances in dev).
  - `app/api/user/*` — Profile, avatar, password updates via Prisma.
  - `prisma/seed.ts` — Demo data + default admin when `ADMIN_PASSWORD` set.
- **Scripts:** `pnpm db:push` (dev schema sync), `pnpm db:migrate` (migrations), `pnpm db:seed` (run seed). Seed and push use `dotenv-cli -e .env.development` so `DATABASE_URL` is loaded.

### PostgreSQL

- **What:** Relational database.
- **Why:** Robust, good for structured data (users, pages, blocks). Local dev via Docker; production (e.g. Neon) with same Prisma client.

### Password hashing (Node crypto)

- **What:** `lib/auth/password.ts` — `scrypt` (async), salt + key stored as `salt:hexKey`.
- **Why:** No external dependency; built-in crypto; timing-safe compare.
- **Where:** Registration hashes password; NextAuth credentials provider verifies via `verifyPassword`.

---

## 7. State & persistence

### Zustand

- **What:** Minimal global state store with optional persistence.
- **Why:** Lightweight; `useSettingsStore` for feature flags (tags per page, tags per block) with `localStorage` persistence.
- **Where:** `lib/stores/settingsStore.ts` — `tagsPerPageEnabled`, `tagsPerBlockEnabled`; persisted to `localStorage['learning-tree-settings']`. Used in SettingsDialog and MainContent/Workspace. Other stores: `lib/stores/recordingStore.ts`, `lib/stores/statsStore.ts`, `lib/stores/uiStore.ts`. All stores are barrel-exported from `lib/stores/index.ts`.

### localStorage

- **What:** Browser key-value store.
- **Where:** Theme (via next-themes), locale (via i18n provider), settings store (via Zustand persist). Not used for page/block data (that is in React state or DB depending on mode).

---

## 8. Testing & quality

### Vitest 4

- **What:** Unit test runner; Jest-compatible API, ESM-native, fast.
- **Why:** Integrates with Vite/Next; watch mode; project-based config for unit vs browser.
- **Where:** `vitest.config.ts`; tests in `**/*.test.ts`, `**/*.test.tsx`. Run: `pnpm test`, `pnpm test:watch`.

### Testing Library (React)

- **What:** Queries and utilities for testing components by role/label, not implementation details.
- **Why:** Encourages accessible markup; tests survive refactors.
- **Where:** `render`, `screen`, `userEvent` in component tests. Patterns: `getByRole('button', { name: /.../ })`, wrap with `I18nProvider`/session mocks where needed.

### Storybook 10

- **What:** Isolated component development and documentation; stories per component.
- **Why:** Visual testing, design review, documentation without running full app.
- **Where:** Stories are co-located alongside components in `__stories__/` directories (e.g. `components/features/Workspace/__stories__/*.stories.tsx`, `app/__stories__/*.stories.tsx`). Storybook template stories (Button, Header, Page) remain in `stories/`. Next.js + Vite integration. Run: `pnpm storybook`.

### ESLint 9 (flat config)

- **What:** Linting for syntax, React, accessibility, and custom rules.
- **Why:** Catch bugs and enforce patterns (e.g. SonarJS complexity).
- **Where:** `eslint.config.mjs`; rules for Next, React, jsx-a11y, Storybook. Run: `pnpm lint`, `pnpm lint:fix`.

### Prettier 3

- **What:** Code formatter (semicolons, quotes, line width).
- **Where:** `prettier.config.js`; plugins for Tailwind class sorting and package.json sort. Run: `pnpm format`, `pnpm format:check`.

### knip

- **What:** Finds unused files, exports, and dependencies.
- **Where:** `knip.json` (or in package.json); run `pnpm knip` to detect dead code.

---

## 9. Build & deploy

### PostCSS

- **What:** CSS pipeline; runs Tailwind and any plugins.
- **Where:** `postcss.config.mjs` — `@tailwindcss/postcss` only (Tailwind v4).

### dotenv-cli

- **What:** Loads env from a file before running a command.
- **Where:** Used in db scripts so Prisma sees `.env.development`: `dotenv -e .env.development -- prisma db push` (and seed, migrate, studio, reset).

### Docker

- **What:** Containers for app and PostgreSQL.
- **Where:** `Dockerfile` (multi-stage Next.js standalone build); `docker-compose.yml` (app + DB); `docker-compose.dev.yml` (DB only for local dev). Run: `pnpm db:dev` (dev DB), `pnpm docker:up` (full stack).

### Next.js standalone output

- **What:** `output: 'standalone'` in `next.config.ts` produces a self-contained server in `.next/standalone` (no full node_modules at runtime).
- **Why:** Smaller production image; Docker runner stage copies only standalone.

---

## Version summary

| Package | Purpose | Version (approx) |
|---------|---------|-------------------|
| next | Framework | 16.x |
| react / react-dom | UI | 19.x |
| typescript | Language | 5.x |
| tailwindcss | Styling | 4.x |
| @tailwindcss/postcss | PostCSS plugin | 4.x |
| next-themes | Theme provider | 0.4.x |
| next-auth | Auth | 5.x beta |
| @prisma/client / prisma | ORM | 6.x |
| @radix-ui/* | UI primitives | varies |
| lucide-react | Icons | 0.5xx |
| @tiptap/* | Rich text | 3.x |
| @monaco-editor/react | Code editor | 4.x |
| @excalidraw/excalidraw | Diagramming canvas | 0.18.x |
| recharts | Statistics charts | 3.x |
| react-activity-calendar | Activity heatmap | 3.x |
| Native HTML5 drag API | Tree DnD | — |
| zustand | Global state | 5.x |
| vitest | Unit tests | 4.x |
| @testing-library/react | Component tests | 16.x |
| storybook | Component dev | 10.x |
| eslint | Linting | 9.x |
| prettier | Formatting | 3.x |
| knip | Dead code | 5.x |
| dotenv-cli | Env for scripts | 7.x |

Exact versions are in `package.json` and lockfile.
