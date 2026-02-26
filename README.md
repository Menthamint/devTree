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
| Diagrams / Canvas | [Excalidraw 0.18](https://excalidraw.com) | Infinite canvas drawing with native Mermaid insert |
| Charts | [Recharts 3](https://recharts.org) | Composable charts for the Statistics section |
| Activity calendar | [react-activity-calendar](https://github.com/grubersjoe/react-activity-calendar) | GitHub-style heatmap for daily activity |
| Drag & drop | Native HTML5 drag API | Tree-view reordering without additional library |
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

## Troubleshooting

### Turbopack build fails — "couldn't find next/package.json from ./app"

Cause: Turbopack infers the workspace root from the source tree and can incorrectly treat the `app/` directory as the project root.

Fix: `next.config.ts` sets `turbopack: { root: '.' }` to pin the workspace root to the repository root. Ensure this option is present if the error recurs.

> For more troubleshooting (auth, database, OAuth), see [docs/SETUP.md — Troubleshooting](docs/SETUP.md#6-troubleshooting).

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
│   ├── api/block/
│   │   └── audio/               # POST upload audio blocks
│   ├── api/folders/             # CRUD for folders (route + [folderId]/)
│   ├── api/pages/               # CRUD for pages (route + [pageId]/)
│   ├── api/stats/               # Statistics API (activity, content, events, summary, topics)
│   ├── api/user/
│   │   ├── avatar/              # POST upload avatar
│   │   ├── libraries/           # GET/POST/DELETE Excalidraw libraries
│   │   ├── password/            # PATCH change password
│   │   ├── preferences/         # GET/PATCH user preferences (JSON column)
│   │   └── profile/             # PATCH name, image
│   ├── forgot-password/         # Password reset placeholder
│   ├── login/                   # Sign-in page (email/password + OAuth)
│   ├── notebook/                # Main workspace — SPA shell (/notebook?page=<id>)
│   ├── p/[pageId]/              # Short redirect → /notebook?page=<id>
│   ├── pages/[pageId]/          # Legacy redirect → /notebook?page=<id>
│   ├── register/                # Redirects to /login?mode=register
│   ├── statistics/              # Statistics dashboard page
│   ├── layout.tsx               # Root layout (fonts, providers)
│   ├── page.tsx                 # Entry point — redirects to /notebook
│   └── globals.css              # Tailwind + Tiptap styles, @theme, @source
│
├── components/
│   ├── editor/                  # Thin re-export shim (EditorToolbar)
│   ├── features/                # Domain-specific components
│   │   ├── editor/              # Tiptap PageEditor + all extensions
│   │   │   └── extensions/      # Custom nodes: AudioNode, CanvasNode, ChecklistNode,
│   │   │                        #   CodeBlockNode, ImageNode, LinkCardNode, TableBlockNode,
│   │   │                        #   VideoNode, BookmarkMark, InlineTagMark, SlashCommand
│   │   ├── FileExplorer/        # Sidebar file tree (FileExplorer.tsx)
│   │   ├── MainContent/         # Right panel: header, page title, tag bar, editor
│   │   │   └── voice-dictation/ # VoiceDictationButton, VoiceDictationLanguageButton,
│   │   │                        #   dictationTextFormatter, recordingHelpers
│   │   ├── SettingsDialog/      # Tabbed settings (Account, Appearance, Features)
│   │   ├── Statistics/          # Charts: ActivityHeatmap, DailyActivityChart,
│   │   │                        #   ContentTypeDonut, TopicsBarChart, StatsSummaryCards,
│   │   │                        #   StreakCard, MotivationBanner
│   │   └── Workspace/           # Root state container + tree utilities
│   │       ├── Workspace.tsx    # Top-level state: pages, folders, active page
│   │       ├── buildTreeData.tsx # Domain model → UI tree adapter
│   │       ├── treeTypes.ts     # TreeRoot / TreeNode types
│   │       ├── treeUtils.ts     # Pure tree manipulation functions
│   │       ├── workspaceApi.ts  # API call helpers for pages/folders
│   │       ├── DeleteConfirmDialog.tsx
│   │       ├── FolderRenameRow.tsx
│   │       └── UnsavedChangesDialog.tsx
│   └── shared/                  # Reusable components
│       ├── ActivityBar/         # Navigation sidebar (ActivityBar + ActivityBarItem)
│       ├── AppShell.tsx         # Top-level app layout
│       ├── providers.tsx        # ThemeProvider + I18nProvider
│       ├── RecordingIndicator.tsx
│       ├── UserMenu/            # Avatar dropdown (theme, language, settings, sign out)
│       └── ui/                  # Radix-based primitives:
│                                #   dialog, alert-dialog, badge, card, tooltip,
│                                #   tree-view (native DnD), Switch, TruncatedText
│
│   Stories are co-located in __stories__/ subdirectories alongside their components.
│
├── lib/
│   ├── auth/password.ts         # Password hashing (scrypt, no external dep)
│   ├── hooks/                   # usePageTracking, useSessionTracking
│   ├── stores/                  # Zustand stores: settingsStore, recordingStore,
│   │                            #   statsStore, uiStore, recordingSound
│   ├── apiAuth.ts               # Shared getToken helper for API routes
│   ├── confirmationContext.tsx  # React context for confirmation dialogs
│   ├── dateUtils.ts             # Date formatting helpers
│   ├── i18n.tsx                 # Internationalisation context (en / uk)
│   ├── notebookPageMemory.ts    # Persist last-viewed page across navigation
│   ├── pageUtils.ts             # Word count, reading time, Markdown export
│   ├── prisma.ts                # Prisma client singleton
│   ├── punctuationService.ts    # Inserts punctuation from voice dictation
│   ├── tiptap-comment-mark.ts  # Tiptap mark for inline comments
│   ├── userPreferences.ts       # Read / write user preferences via API
│   └── utils.ts                 # cn() Tailwind class merge helper
│
├── messages/                    # en.json, uk.json
├── prisma/                      # schema.prisma, seed.ts, migrations/
├── stories/                     # Storybook template pages (Button, Header, Page demos)
├── tests/e2e/                   # C# .NET 9 + Playwright E2E
│
├── docs/                        # Detailed documentation
│   ├── README.md                # Docs index
│   ├── ARCHITECTURE.md          # Design, diagrams, algorithms
│   ├── TECH-STACK.md            # All libs and technologies
│   ├── AUTH.md                  # Authentication flow
│   ├── SETUP.md                 # Environment, DB, troubleshooting
│   └── SECURITY.md              # Security measures, performance notes
│
├── next.config.ts               # Next.js config (standalone output, turbopack root)
├── Dockerfile                   # Multi-stage production image
├── docker-compose.yml           # Full stack: app + PostgreSQL
├── docker-compose.dev.yml       # Dev: PostgreSQL only
└── .env.development.example     # Environment variable template
```

---

## How to Add a New Block Type

Adding a new block type involves extending the Tiptap editor with a new node extension.

1. **Add the extension** — create `components/features/editor/extensions/XXXNode.tsx`
2. **Register in PageEditor** — add the extension to the `extensions` array in `PageEditor.tsx`
3. **Add i18n keys** to `messages/en.json` and `messages/uk.json`
4. **Register the slash command** — add an entry in `SlashCommand.tsx`

Don't forget to:
- Write a unit test alongside the extension file
- Write a Storybook story in `components/features/editor/__stories__/`
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
