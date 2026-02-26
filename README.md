# DevTree — Learning Workspace

A **personal knowledge base** built as a learning project to explore modern full-stack web development. Create structured notes with rich text, code snippets, tables, checklists, links, images, audio, diagrams, whiteboards, and embedded videos — all in a drag-and-drop block editor.

> **Learning goal:** Understand how a real production-grade React application is architected, tested, and deployed — with source code that is intentionally over-commented for educational purposes.

---

## Features

| Feature | Description |
|---------|-------------|
| 📝 **Block editor** | 10 block types: Text (rich text), Code (Monaco), Table, Checklist, Link, Image, Audio, Diagram, Video, Whiteboard |
| 🗂️ **File explorer** | Sidebar tree with folders, drag-and-drop reordering, rename, delete, duplicate-name validation |
| 🔗 **Deep links** | Open a page directly by URL (`/pages/[pageId]`) and share links to specific notes |
| ⚡ **Transition skeletons** | Immediately hides previous notebook content on page switch and shows loading skeletons |
| ↩️ **Page restore** | Returning to Notebook from another section reopens your last viewed notebook page |
| 🧭 **Breadcrumbs** | Clickable breadcrumb path in header for fast folder/page navigation |
| 🎨 **Themes** | Light / Dark / System via `next-themes` |
| 🌍 **Internationalisation** | English and Ukrainian; persisted in cookie and `localStorage` (correct language on refresh) |
| 📱 **Responsive** | Mobile-first layout with a slide-in sidebar drawer |
| 🔍 **Search** | Filter pages by title or content (Cmd+K) |
| 📊 **Page stats** | Word count, estimated reading time, block count |
| ⬇️ **Export** | Download any page as a Markdown `.md` file |
| ⌨️ **Keyboard shortcuts** | `Cmd+S` save · `Cmd+K` search |
| 🧪 **Testing** | Vitest unit tests · Storybook stories · C# .NET + Playwright E2E |
| 🐳 **Docker** | Full-stack Docker Compose setup with PostgreSQL |

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | [Next.js 16](https://nextjs.org) (App Router) | SSR, file routing, standalone Docker output |
| UI library | [React 19](https://react.dev) | Component model, hooks, concurrent features |
| Language | [TypeScript 5](https://typescriptlang.org) | Static types, better refactoring, fewer runtime bugs |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) | Utility-first, no CSS files, dark mode via class |
| Components | [Radix UI](https://radix-ui.com) | Headless accessible primitives (dialogs, menus) |
| Icons | [Lucide React](https://lucide.dev) | Consistent SVG icon set |
| Rich text | [Tiptap 3](https://tiptap.dev) | Headless ProseMirror editor, extensible |
| Code editor | [Monaco Editor](https://microsoft.github.io/monaco-editor/) | VS Code engine, syntax highlighting for 40+ languages |
| Diagrams | [Mermaid.js 11](https://mermaid.js.org) | Text-to-diagram: flowcharts, sequence diagrams, ERDs |
| Drag & drop | [@dnd-kit](https://dndkit.com) | Accessible DnD with pointer and keyboard sensors |
| Auth | [NextAuth v5](https://authjs.dev) | Google + GitHub OAuth, JWT sessions |
| Database | [PostgreSQL](https://postgresql.org) + [Prisma 6](https://prisma.io) | Type-safe ORM, migrations |
| Unit tests | [Vitest 4](https://vitest.dev) + [Testing Library](https://testing-library.com) | Fast, Jest-compatible, ESM native |
| Component dev | [Storybook 10](https://storybook.js.org) | Isolated component development and visual testing |
| E2E tests | [C# .NET 9 + Playwright](https://playwright.dev) | Cross-browser E2E with Page Object Model |
| Package manager | [pnpm](https://pnpm.io) | Fast, disk-efficient, strict dependency resolution |
| Linting | [ESLint 9](https://eslint.org) (flat config) + SonarJS + jsx-a11y + storybook | Catch bugs, enforce patterns, accessibility |
| Dead-code detection | [knip](https://knip.dev) | Find unused files, exports, and dependencies |
| Formatting | [Prettier 3](https://prettier.io) + import-sort + tailwindcss | Consistent style, auto-sorted imports |
| State management | [Zustand](https://zustand-demo.pmnd.rs) | Minimal global state with `localStorage` persistence |

---

## Prerequisites

- **Node.js 20+** — [download](https://nodejs.org)
- **pnpm** — `npm install -g pnpm`
- **Docker** (optional, for local DB) — [download](https://docker.com)
- **.NET 9 SDK** (optional, for E2E tests) — [download](https://dotnet.microsoft.com)

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-username/devTree.git
cd devTree

# 2. Install dependencies
pnpm install

# 3. Start PostgreSQL (Docker) + configure auth
pnpm db:dev
cp .env.development.example .env.development
# Edit .env.development: add AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

# 4. Run migrations and seed
pnpm db:push
pnpm db:seed

# 5. Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Google to access the workspace.

---

## Setup with Database and Auth

### 1. Start local PostgreSQL (Docker)

```bash
pnpm db:dev
```

This runs Postgres in Docker on port 5432.

### 2. Configure environment variables

```bash
cp .env.development.example .env.development
# Edit .env.development with your values (see below)
```

### 3. Google OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID (Web application)
3. Add redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy Client ID and Client Secret into `.env.development`

### 4. Run migrations and seed

```bash
pnpm db:push
pnpm db:seed
```

### 5. Start the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). You’ll be redirected to `/login`. Sign in with:
- **Default admin** — Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env.development`, run `pnpm db:seed`, then log in with those credentials (default: `admin@localhost`).
- **Email & password** — Create an account at `/register`
- **Google** or **GitHub** — OAuth (configure credentials in env)

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (local: `postgresql://devtree:devtree@localhost:5432/devtree`; Vercel: Neon connection string) |
| `NEXTAUTH_URL` | App URL (local: `http://localhost:3000`; prod: `https://your-app.vercel.app`) |
| `AUTH_SECRET` | Secret for JWT signing (generate with `openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth credentials |
| `ADMIN_EMAIL` | Email for the default admin account (default: `admin@localhost`). Created/updated when you run `pnpm db:seed` and `ADMIN_PASSWORD` is set. |
| `ADMIN_PASSWORD` | Password for the default admin account. Set this and run `pnpm db:seed` to create or update the admin user. |

`.env.development` is gitignored. Use `.env.development.example` as a template.

---

## Deploy to Vercel with Neon

1. **Neon** — Create a project at [neon.tech](https://neon.tech) and copy the connection string.
2. **Vercel** — Import the repo, add env vars: `DATABASE_URL` (Neon), `NEXTAUTH_URL` (your Vercel URL), `AUTH_SECRET`, `GOOGLE_*`, `GITHUB_*`.
3. **OAuth** — For Google/GitHub, add production callback URLs (e.g. `https://your-app.vercel.app/api/auth/callback/google`).
4. **Migrations** — Run `pnpm db:migrate:deploy` after first deploy (or add a build step) so Prisma creates tables in Neon.

JWT sessions work well with Vercel serverless and Neon — no DB round-trips for session checks.

---

## Available Scripts

```bash
# Development
pnpm dev              # Start Next.js dev server with Turbopack
pnpm build            # Create production build
pnpm start            # Serve the production build

# Code quality
pnpm lint             # ESLint — check all source files
pnpm lint:fix         # ESLint — auto-fix fixable issues
pnpm format           # Prettier — format all files
pnpm format:check     # Prettier — verify formatting without writing
pnpm knip             # knip — find unused files, exports, dependencies

# Testing
pnpm test             # Run all Vitest unit tests (once)
pnpm test:unit        # Run unit tests only
pnpm test:watch       # Watch mode — re-runs on file changes

# Storybook (component development)
pnpm storybook        # Start Storybook on http://localhost:6006
pnpm build-storybook  # Build static Storybook site

# Database
pnpm db:dev           # Start Docker PostgreSQL (dev only)
pnpm db:migrate       # Run Prisma migrations (production)
pnpm db:push          # Push schema to DB (dev — no migration history)
pnpm db:seed          # Populate DB with sample data
pnpm db:studio        # Open Prisma Studio (visual DB browser)
pnpm db:reset         # Drop and recreate DB, re-seed

# Docker
pnpm docker:up        # Start full stack (app + DB) with Docker Compose
pnpm docker:down      # Stop and remove all containers
```

---

## Running E2E Tests (C# .NET 9 + Playwright)

```bash
cd tests/e2e

# Install .NET dependencies and Playwright browsers (first time)
dotnet build
pwsh bin/Debug/net9.0/playwright.ps1 install

# Run all tests (app must be running at http://localhost:3000)
dotnet test

# Override base URL
DEVTREE_BASE_URL=http://localhost:3001 dotnet test

# Run in headed (visible browser) mode
dotnet test -- NUnit.DefaultTestNamePattern="{m}{a}" Playwright.LaunchOptions.Headless=false
```

See [`tests/e2e/README.md`](tests/e2e/README.md) for full details.

---

## Project Structure

```
devTree/
├── app/                         # Next.js App Router
│   ├── api/auth/
│   │   ├── [...nextauth]/       # NextAuth route handler (JWT, OAuth, session)
│   │   └── register/            # Registration API (email + password)
│   ├── api/user/
│   │   ├── profile/             # PATCH name, image
│   │   ├── avatar/              # POST upload avatar
│   │   └── password/            # PATCH change password
│   ├── login/                   # Sign-in page (email/password + OAuth)
│   ├── register/                # Redirects to /login?mode=register
│   ├── forgot-password/         # Password reset placeholder
│   ├── layout.tsx               # Root layout (fonts, providers)
│   ├── page.tsx                 # Entry point → renders <Workspace>
│   └── globals.css              # Tailwind + Tiptap styles, @theme, @source
│
├── components/
│   ├── FileExplorer/            # Sidebar file tree
│   ├── MainContent/             # Right panel: header, editor, stats
│   │   └── blocks/              # 10 block type components
│   ├── SettingsDialog/          # Tabbed settings (Account, Appearance, Features)
│   ├── UserMenu/                # Avatar dropdown (theme, language, settings, sign out)
│   ├── Workspace/               # App shell (layout + state)
│   │   ├── Workspace.tsx        # Root state container
│   │   ├── buildTreeData.tsx    # Domain model → UI tree adapter
│   │   ├── treeTypes.ts         # TreeRoot / TreeNode types
│   │   ├── treeUtils.ts         # Pure tree manipulation functions
│   │   ├── samplePages.ts       # Demo content
│   │   └── DeleteConfirmDialog.tsx
│   └── ui/                      # Radix-based primitives (dialog, tree-view, etc.)
│
├── lib/
│   ├── auth/password.ts         # Password hashing (scrypt)
│   ├── i18n.tsx                 # Internationalisation context
│   ├── pageUtils.ts             # Stats, Markdown export
│   ├── prisma.ts                # Prisma client singleton
│   ├── settingsStore.ts         # Zustand store (tags per page/block)
│   └── utils.ts                 # cn() Tailwind helper
│
├── messages/                    # en.json, uk.json
├── prisma/                      # schema.prisma, seed.ts
├── stories/                     # Storybook stories (components + blocks)
├── tests/e2e/                   # C# .NET + Playwright E2E
│
├── docs/                        # Detailed documentation
│   ├── README.md                # Docs index
│   ├── ARCHITECTURE.md          # Design, diagrams, algorithms
│   ├── TECH-STACK.md            # All libs and technologies
│   ├── AUTH.md                  # Authentication flow
│   ├── SETUP.md                 # Environment, DB, troubleshooting
│   └── SECURITY.md              # Security measures, performance notes
│
├── Dockerfile                   # Multi-stage production image
├── docker-compose.yml           # Full stack: app + PostgreSQL
├── docker-compose.dev.yml       # Dev: PostgreSQL only
└── .env.example                 # Environment variable template
```

---

## How to Add a New Block Type

Adding a new block type involves 6 steps:

1. **Add the type name** to `BlockType` in `components/MainContent/types.ts`
2. **Define the content shape** — add a `XXXBlockContent` type and add it to the `BlockContent` union
3. **Create the component** — `components/MainContent/blocks/XXXBlock.tsx`
4. **Register in the factory** — add a `case 'xxx':` in `createBlock()` in `BlockEditor.tsx`
5. **Register the renderer** — add a `case 'xxx':` in the `BlockContent` `switch` in `BlockEditor.tsx`
6. **Add to the picker** — add an entry in `BLOCK_DEFS` in `BlockPicker.tsx` with label/description i18n keys

Don't forget to:
- Add i18n keys to `messages/en.json` and `messages/uk.json`
- Write a unit test in `components/MainContent/blocks/XXXBlock.test.tsx`
- Write a Storybook story in `stories/blocks/XXXBlock.stories.tsx`
- Handle the type in `blockToMarkdown()` in `lib/pageUtils.ts`

---

## Documentation

| Doc | Description |
|-----|-------------|
| [**docs/README.md**](docs/README.md) | Documentation index and quick links |
| [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md) | System design, component hierarchy, data model, state flow, DnD, tree algorithms, i18n, testing |
| [**docs/TECH-STACK.md**](docs/TECH-STACK.md) | Every library and technology in detail (versions, why, where used) |
| [**docs/AUTH.md**](docs/AUTH.md) | Authentication: NextAuth, credentials, OAuth, session, middleware, user APIs |
| [**docs/SETUP.md**](docs/SETUP.md) | Environment variables, database, seeding, troubleshooting |
| [**docs/SECURITY.md**](docs/SECURITY.md) | Security (auth, passwords, uploads, XSS), performance, locale persistence |

Mermaid diagrams in the docs render on GitHub and in editors with a Mermaid extension. For dependency visualization you can use `npx madge --extensions ts,tsx --image graph.svg app components lib` (see docs/README.md).

---

## Contributing

This is a learning project. Contributions, experiments, and questions are welcome!

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes with tests
4. Run `pnpm test` to verify
5. Open a pull request

---

## License

MIT
