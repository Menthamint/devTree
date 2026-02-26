# DevTree — Documentation Index

This folder contains detailed documentation for the Learning Tree (DevTree) project. Each document focuses on a specific area so you can dive as deep as you need.

---

## Documentation Map

| Document | Purpose | When to read |
|----------|---------|----------------|
| [**ARCHITECTURE.md**](./ARCHITECTURE.md) | System design, component hierarchy, data flow, algorithms (tree, DnD, i18n), Mermaid diagrams | Understanding how the app is built and why |
| [**TECH-STACK.md**](./TECH-STACK.md) | Every library and technology: what it does, why it was chosen, version, and key APIs used | Onboarding, upgrading dependencies, or comparing alternatives |
| [**AUTH.md**](./AUTH.md) | Authentication flow: NextAuth, credentials, OAuth, session, route protection, user profile APIs | Working on login, sign-up, or protected routes |
| [**SETUP.md**](./SETUP.md) | Environment variables, database, seeding, default admin, Docker, and troubleshooting | First-time setup or changing environment |
| [**SECURITY.md**](./SECURITY.md) | Security measures (auth, passwords, uploads, XSS), env/secrets, performance notes | Security review or hardening |

---

## Quick Links

- **Main README** — [../README.md](../README.md): features, quick start, scripts, project structure.
- **E2E tests** — [../tests/e2e/README.md](../tests/e2e/README.md): C# .NET + Playwright setup and usage.
- **Code comments** — The codebase is heavily commented; start from `Workspace.tsx`, `MainContent.tsx`, and `app/api/auth/[...nextauth]/route.ts` for high-level flow.
- **Locale and refresh** — Initial language is resolved from cookie (or `Accept-Language`). A head script syncs the cookie from `localStorage` when missing and reloads once so the next load uses the correct locale (see [SECURITY.md](./SECURITY.md) and root `app/layout.tsx`).

---

## Structure and dependency visualization

- **Mermaid diagrams** — Used in `ARCHITECTURE.md` (component hierarchy, data flow, auth, deployment). Render in GitHub, VS Code (Mermaid extension), or [mermaid.live](https://mermaid.live).
- **npm libs for project structure / dependency graphs** (optional, not required for development):
  - **[madge](https://www.npmjs.com/package/madge)** — Builds a graph of module dependencies; can output an image (e.g. SVG) or list circular dependencies. Example: `npx madge --extensions ts,tsx --image graph.svg app components lib`.
  - **[dependency-cruiser](https://www.npmjs.com/package/dependency-cruiser)** — Validates dependency rules and can output graphs (e.g. `--output-type dot` for GraphViz). Example: `npx dependency-cruiser app components lib --output-type err`.
  - **[knip](https://www.npmjs.com/package/knip)** — Finds unused files, dependencies, and exports. Example: `npx knip`.
- These tools help when refactoring, onboarding, or auditing structure; add them as devDependencies and a script in `package.json` if you use them regularly.

---

## Contributing to docs

- Keep **ARCHITECTURE.md** focused on *design and algorithms*; move long “how to use library X” notes to **TECH-STACK.md** or **AUTH.md**.
- Use **Mermaid** for diagrams so they stay in repo and render on GitHub.
- When adding a major feature (e.g. new auth provider, new block type), update the relevant doc and the main README’s project structure.
