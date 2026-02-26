# DevTree — Test Plan

This document describes every level of testing applied to DevTree, explains *why* each test exists, and links the test locations to expected behaviour. It is intended both as a reference for developers and as a learning resource for understanding test strategy.

---

## Table of Contents

1. [Testing Philosophy](#1-testing-philosophy)
2. [Test Pyramid](#2-test-pyramid)
3. [Unit Tests](#3-unit-tests)
4. [Component Tests (React Testing Library)](#4-component-tests-react-testing-library)
5. [API Route Tests (planned)](#5-api-route-tests-planned)
6. [End-to-End Tests (Playwright / C#)](#6-end-to-end-tests-playwright--c)
7. [Test Data Management](#7-test-data-management)
8. [Running Tests](#8-running-tests)
9. [Coverage Goals](#9-coverage-goals)

---

## 1. Testing Philosophy

> **"Test behaviour, not implementation."**

A test should answer: *"Does this feature work for the user?"* — not *"Is this private variable set correctly?"*

Three rules we follow:

1. **Arrange–Act–Assert** — every test has a clear setup, a single user action, and a precise assertion.
2. **Realistic selectors** — prefer `getByRole`, `getByLabelText`, `getByTestId` (accessibility-based) over CSS class selectors that break on UI refactors.
3. **One reason to fail** — each test covers one scenario. If a test breaks, the failure message should immediately tell you which feature regressed.

---

## 2. Test Pyramid

```
         ▲
        / \       E2E tests (Playwright / C#)
       /   \      Slow, brittle, expensive per test.
      /─────\     Cover full user journeys.
     /       \
    /─────────\   Component tests (Vitest + RTL)
   /           \  Fast, isolated. Cover React components.
  /─────────────\
 /               \ Unit tests (Vitest)
/─────────────────\ Fast, pure functions. Cover utilities.
```

| Layer | Technology | Location | Speed |
|-------|-----------|----------|-------|
| Unit + Component | Vitest + React Testing Library | co-located `.test.tsx` files | ~1–3 s |
| E2E | NUnit + Playwright (C#) | `tests/e2e/` | ~30–120 s |

---

## 3. Unit Tests

Unit tests cover pure utility functions with no React or DOM dependencies.

### `lib/pageUtils.ts`

**File:** [`lib/pageUtils.test.ts`](../lib/pageUtils.test.ts)

| Test | What it verifies |
|------|-----------------|
| `computePageStats` — empty page | Returns zeros for an empty block list |
| `computePageStats` — single text block | Counts words and estimates reading time correctly |
| `computePageStats` — mixed block types | Only text/code blocks contribute to word count |
| `downloadMarkdown` — page with blocks | Serialises blocks to Markdown and triggers a download |

**Why these tests?**

`computePageStats` is a pure function. It takes an array and returns a number — it's the easiest kind of code to unit-test, and regressions would silently break the stats footer.

### `lib/dateUtils.ts`

**File:** [`lib/dateUtils.test.ts`](../lib/dateUtils.test.ts)

| Test | What it verifies |
|------|------------------|
| `formatRelativeTime` — 0 s ago | Returns `"just now"` |
| `formatRelativeTime` — 59 s ago | Still returns `"just now"` (below 1-minute threshold) |
| `formatRelativeTime` — 60 s ago | Returns `"1 minute ago"` (singular) |
| `formatRelativeTime` — 5 min ago | Returns `"5 minutes ago"` (plural) |
| `formatRelativeTime` — 59 min ago | Returns `"59 minutes ago"` (just under hour threshold) |
| `formatRelativeTime` — 60 min ago | Returns `"1 hour ago"` (singular) |
| `formatRelativeTime` — 3 h ago | Returns `"3 hours ago"` |
| `formatRelativeTime` — 23 h ago | Returns `"23 hours ago"` (just under day threshold) |
| `formatRelativeTime` — 24 h ago | Returns `"1 day ago"` (singular) |
| `formatRelativeTime` — 6 days ago | Returns `"6 days ago"` |
| `formatRelativeTime` — 7 days ago | Returns `"1 week ago"` (singular) |
| `formatRelativeTime` — 29 days ago | Returns `"4 weeks ago"` |
| `formatRelativeTime` — 30+ days ago | Falls back to medium locale date (no `"ago"`) |
| `formatRelativeTime` — ISO string input | Accepts ISO datetime strings from the API, not just Date objects |
| `formatRelativeTime` — exactly 1 week | Returns `"1 week ago"` |

**Why these tests?**

`formatRelativeTime` drives the timestamp display on every page and block. Threshold boundary tests are essential because off-by-one errors (e.g. `< 60` vs `<= 60`) would silently produce wrong relative strings. Using `vi.useFakeTimers` with a fixed `Date.now()` makes all assertions deterministic.

### `lib/i18n.tsx`

**File:** [`lib/i18n.test.tsx`](../lib/i18n.test.tsx)

| Test | What it verifies |
|------|-----------------|
| Renders children | `I18nProvider` renders its children |
| Default locale is English | `t('sidebar.show')` returns English string by default |
| `setLocale` switches language | After calling `setLocale('uk')`, `t('sidebar.show')` returns Ukrainian |
| Template substitution | `t('key', { name: 'Test' })` replaces `{{name}}` in the string |
| Missing key fallback | Returns the key itself when no translation is found |

**Why these tests?**

The i18n system is used in every component. A bug here would break the entire UI silently (buttons would show raw translation keys).

---

## 4. Component Tests (React Testing Library)

Component tests render a component into a virtual DOM (happy-dom) and simulate user interactions. They test the component's **public contract**: what the user sees and what callbacks are fired.

### `components/MainContent/PageTitle.tsx`

**File:** [`components/MainContent/PageTitle.test.tsx`](../components/MainContent/PageTitle.test.tsx)

| Test | What it verifies |
|------|-----------------|
| Read-only mode | Shows `<h1>` (not input) when `readOnly=true` |
| Editable mode | Shows `<input>` when `onTitleChange` is provided |
| `onTitleChange` fires | Typing in the input fires `onTitleChange` with the new value |
| `onTitleBlur` fires | Clicking away from the title input calls `onTitleBlur` |
| Duplicate-name invalid state | Duplicate title keeps input invalid (`aria-invalid=true`) and does not persist |
| Empty title placeholder | Shows placeholder text when title is empty in edit mode |

**Key design note — why `onTitleBlur` instead of debounce?**

An earlier version of DevTree debounced `onTitleChange` and sent an API call on every keystroke. This caused:
- A PUT request per character typed — wasteful.
- Race conditions (out-of-order responses could overwrite newer edits).

The current design fires `onTitleChange` for local state updates (zero latency) and `onTitleBlur` to persist to the server only when the user is done typing.

### `components/MainContent/BlockEditor.tsx`

**File:** [`components/MainContent/BlockEditor.test.tsx`](../components/MainContent/BlockEditor.test.tsx)

| Test | What it verifies |
|------|-----------------|
| Empty state | Shows "Add your first block" prompt when `blocks=[]` |
| Add block button is present | "+" button renders |
| Block picker opens | Clicking "+" shows the block picker popover |
| Selecting a block type | Choosing a type fires `onChange` with the new block appended |
| Renders existing blocks | One `BlockWrapper` per block |
| Block delete | Hovering + clicking delete fires `onChange` with the block removed |
| Block colSpan toggle | Toggling full/half width fires `onChange` with updated `colSpan` |

### `components/MainContent/blocks/ImageBlock.tsx`

**File:** [`components/MainContent/blocks/ImageBlock.test.tsx`](../components/MainContent/blocks/ImageBlock.test.tsx)

| Test | What it verifies |
|------|-----------------|
| Edit form shown for empty URL | When `url=''`, the form renders immediately |
| URL, alt and caption inputs exist | All three fields are present |
| Apply saves the URL | Clicking "Apply" calls `onChange` with the typed URL |
| Apply saves alt and caption | All three fields are included in the `onChange` payload |
| Enter key saves | Pressing Enter in any input triggers save |
| Image renders when URL is set | An `<img>` element appears with correct `src` and `alt` |
| Cancel discards | Clicking "Cancel" reverts to the previous URL |
| Edit button shows on hover | The edit pencil button appears when hovering the image |

**Why "Apply" not "Save"?**

These are *block-level* inline forms. "Apply" signals "apply these settings to this block" — distinct from the page-level "Save" which persists everything to the server. This prevents user confusion about which action saves to the database.

### `components/MainContent/blocks/VideoBlock.tsx`

**File:** [`components/MainContent/blocks/VideoBlock.test.tsx`](../components/MainContent/blocks/VideoBlock.test.tsx)

| Test | What it verifies |
|------|-----------------|
| Applies a trimmed URL | "Apply" calls `onChange` with whitespace stripped |
| YouTube renders embedded `<iframe>` | A YouTube URL produces an embed, not a plain link |
| Non-YouTube renders as link | Other URLs fall back to an `<a>` link |
| Cancel reverts URL | Cancelling does not call `onChange` |

### `components/MainContent/blocks/AudioBlock.tsx`

**File:** [`components/MainContent/blocks/AudioBlock.test.tsx`](../components/MainContent/blocks/AudioBlock.test.tsx)

| Test | What it verifies |
|------|-----------------|
| Empty state shows "no audio yet" | Placeholder text for empty URL |
| "Add audio URL" button triggers edit mode | `enterEdit` callback is called |
| Apply button is disabled when URL is empty | Cannot save an empty URL |

### `components/Workspace/treeUtils.ts`

**File:** [`components/Workspace/treeUtils.test.ts`](../components/Workspace/treeUtils.test.ts)

| Test | What it verifies |
|------|-----------------|
| Scope name normalization | Duplicate checks use trim + case-insensitive matching |
| Duplicate detection in root and folder scope | Sibling-name collisions are detected in both scopes |
| Excluding current node on rename | Renaming current node to same name is allowed |
| Unique default names | Generates `Untitled`, `Untitled 2`, `Untitled 3` format |
| First page in subtree | Breadcrumb folder click can resolve a target page id |
| Apply button is enabled after typing a URL | Becomes enabled once URL is non-empty |
| Apply saves with trimmed URL | Whitespace stripped from URL |
| Apply saves with caption | Caption is included in the `onChange` payload |
| Cancel calls `exitEdit` | Cancel button fires the exit callback |

### `components/MainContent/blocks/LinkBlock.tsx`

**File:** [`components/MainContent/blocks/LinkBlock.test.tsx`](../components/MainContent/blocks/LinkBlock.test.tsx)

| Test | What it verifies |
|------|-----------------|
| Renders link with label and URL | `href`, `target="_blank"`, `rel="noopener noreferrer"` |
| Uses URL as display text when no label | Falls back gracefully |
| Shows URL below label | Secondary detail is visible |
| Shows edit form for empty URL | Starts in edit mode when URL is empty |

### `components/Statistics/` — MotivationBanner, StreakCard, StatsSummaryCards

**File:** [`components/Statistics/statistics.test.tsx`](../components/Statistics/statistics.test.tsx)

These tests ensure the statistics UI components render correctly across all key data states and user interactions.

#### `MotivationBanner`

| Test | What it verifies |
|------|-----------------|
| `data=null` renders nothing | `null` prop returns null output |
| Daily message shown for new user | When no achievements qualify, a rotating daily message appears |
| First-note achievement | `totalPages >= 1` shows the "Achievement" label and first-note message |
| 7-day streak milestone | `streakCurrent >= 7` shows "Milestone reached!" with streak message |
| 30-day streak | Full message text is rendered |
| 100-day milestone (celebration) | "Milestone reached!" + confetti particles rendered |
| 50-notes achievement | Correct achievement shown when streak < any milestone |
| Highest priority wins | 100-day streak takes precedence over 50-notes when both qualify |
| Dismiss button | Clicking × removes the banner from the DOM |
| Source explanation text | "rotates daily" info text is visible to users |
| Already-dismissed today | Banner hidden when `localStorage` key is set to today's date |

**Design note — `forceShow` prop:**  
The component guards against showing twice per day via `localStorage`. All tests use `forceShow={true}` to bypass this guard, making tests deterministic regardless of when they run.

#### `StreakCard`

| Test | What it verifies |
|------|-----------------|
| Loading skeletons while `loading=true` | No streak number visible |
| 0-day streak — no badge | Default empty state |
| Current streak number | Correct count appears in large text |
| Best streak displayed | "Best: N days" sub-label |
| Progress toward next milestone | "N days to X-day milestone" progress bar |
| 7-day milestone badge | Badge appears when milestone is hit |
| 100-day milestone badge | Champion badge |
| 365+ days — no progress bar | No "days to milestone" shown beyond all milestones |

#### `StatsSummaryCards`

| Test | What it verifies |
|------|-----------------|
| Loading skeletons | Animated pulse divs when `loading=true` |
| All four card titles | "Total Notes", "Total Blocks", "Total Time in App", "Writing Time" |
| Correct count values | Numbers match `totalPages` and `totalBlocks` |
| Formatted durations | "5h" for session, "2h 30m" for writing |
| Writing focus % sub-stat | `(writingMs / sessionMs) * 100` displayed |
| Avg blocks/note sub-stat | `totalBlocks / totalPages.toFixed(1)` displayed |
| Zero-session safety | No division-by-zero; no `NaN` in output |
| Null data graceful | Skeletons shown even when `loading=false` but `data=null` |

---

## 5. API Route Tests (planned)

> These tests do not exist yet. They are planned for a future iteration.

API routes live under `app/api/`. They should be tested with a test database (or mocked Prisma client).

### Planned tests for `/api/pages`

| Endpoint | Scenario | Expected |
|----------|----------|----------|
| `POST /api/pages` | Create page (authenticated) | 201 + page object |
| `POST /api/pages` | Unauthenticated | 401 |
| `GET /api/pages` | List pages for user | 200 + array |
| `PUT /api/pages/:id` | Update title | 200 + updated page |
| `PUT /api/pages/:id` | Wrong user (another user's page) | 404 |
| `DELETE /api/pages/:id` | Delete existing page | 200 |

### Planned tests for `/api/block`

| Endpoint | Scenario | Expected |
|----------|----------|----------|
| `POST /api/block` | Create block | 201 + block with server UUID |
| `PUT /api/block/:id` | Update block content | 200 + updated block |
| `DELETE /api/block/:id` | Delete block | 200 |
| `POST /api/block/reorder` | Reorder blocks | 200 |
| Any block route | Wrong user | 403 or 404 |

**Why test the API separately from E2E?**

E2E tests verify the full stack but don't tell you *which layer* failed. A failing API test pinpoints exactly which endpoint broke, making debugging faster.

---

## 6. End-to-End Tests (Playwright / C#)

E2E tests launch a real browser, navigate the app, and assert visible DOM changes. They test complete user journeys from log-in to data persistence.

**Technology:** [Playwright](https://playwright.dev) via the `Microsoft.Playwright.NUnit` package (C#). Tests are in `tests/e2e/Tests/`.

**Page Object Model:** Each screen has a dedicated C# class (`SidebarPage`, `EditorPage`, `AppPage`) that encapsulates locators and helper methods. This makes tests readable and resilient to UI changes.

### Login Tests — `LoginTests.cs`

| Test | Journey |
|------|---------|
| Valid credentials log in | Fill email + password → land on workspace |
| Invalid password shows error | Error message appears |
| Forgot password link works | Navigates to forgot-password page |

### Sidebar Tests — `SidebarTests.cs`

| Test | Journey |
|------|---------|
| Create page | Click "+" → unique default name appears in tree (`Untitled`, `Untitled 2`, …) |
| Select page | Click page → editor header shows page title |
| Rename page | Double-click → type new name → blur → title updated  |
| Duplicate rename blocked | Enter duplicate sibling name → toast + invalid frame + no save |
| Delete page | Delete button → confirm → page gone from tree |
| Create folder | "New folder" button → folder appears in tree |
| Move page into folder | Drag page onto folder → nested in tree |

### Editor Tests — `EditorTests.cs`

| Test | Journey |
|------|---------|
| New page has 0 blocks | Count `.group/block` = 0 |
| Add Text block | "+" → "Text" → block count +1 |
| Type in Text block | Tiptap shows typed text |
| Add Code block | Monaco editor visible |
| Change code language | Language button shows selected language |
| Add Table block | Default columns visible |
| Fill table cell | Cell has entered value |
| Add row to table | Row count increases |
| Add Image block | Apply URL → `<img>` visible |
| Add Video block | YouTube URL → `<iframe>` visible |
| Add Link block | Apply URL → `<a>` visible |
| Delete block | Hover + delete → block count -1 |

### Save Tests — `SaveTests.cs`

| Test | Journey |
|------|---------|
| Save button disabled on clean page | Button has `disabled` attribute |
| Save button enabled after title edit | Type in title → button enabled |
| Save button enabled after adding block | Add block → button enabled |
| Save button disabled after save | Click Save → button becomes disabled |
| Navigate away from dirty page shows dialog | Add block → click other page → dialog visible |
| Cancel stays on page | Click "Cancel / Stay" → dialog gone, no navigation |
| Leave without saving navigates | Click "Leave without saving" → opens new page |
| Save and leave saves then navigates | Click "Save and leave" → data saved, new page opens |

### Settings Tests — `SettingsTests.cs`

| Test | Journey |
|------|---------|
| Open settings dialog | Click avatar → "Settings" → dialog visible |
| Change language to Ukrainian | Select "Ukrainian" → UI labels switch language |
| Toggle dark mode | Switch to "Dark" → `<html class="dark">` |
| Tags per page toggle | Toggle feature flag → TagBar appears/disappears |
| Tags per block toggle | Toggle → block tag filter appears/disappears |

### Notebook Page Content Tests — `NotebookContentTests.cs`

These tests cover the **notebook page content area** in depth: everything the user sees and does _inside_ the main content panel of a notebook page. They complement `EditorTests.cs` (block add/delete) and `SaveTests.cs` (dirty-state detection) by focusing on content-level UX: rendering, persistence, formatting, statistics, export, link cards, audio, inline-tag filtering, and keyboard shortcuts.

#### Page Rendering

| Test | Journey |
|------|---------|
| `ReadMode_ShowsPageTitle` | Open a saved page → `<h1>` contains the page title |
| `ReadMode_ShowsBlocks` | Open a page with blocks → at least one `.page-editor-content > *` element visible |
| `ReadMode_NoEditControls` | View mode → "Add block" button is NOT visible |
| `EditMode_ShowsEditButton` | Start in view mode → "Edit page" button visible |
| `EditMode_ShowsSaveButton` | Click "Edit page" → "save-page-button" visible, "Edit page" hidden |

#### Content Persistence

| Test | Journey |
|------|---------|
| `TextContent_PersistsAfterSaveAndReload` | Add text block → type text → save → reload page → text still visible |
| `CodeContent_PersistsAfterSaveAndReload` | Add code block → type code → change language to Python → save → reload → code and language preserved |
| `TableContent_PersistsAfterSaveAndReload` | Add table → fill header + cell → save → reload → values preserved |
| `ChecklistContent_PersistsAfterSaveAndReload` | Add checklist → add item → check it → save → reload → item text and checked state preserved |
| `PageTitle_PersistsAfterSaveAndReload` | Edit title → save → reload → title shown in header and sidebar |

#### Editor Toolbar

| Test | Journey |
|------|---------|
| `EditorToolbar_VisibleInEditMode` | Enter edit mode → editor toolbar appears above editor area |
| `EditorToolbar_HiddenInViewMode` | View mode → toolbar is NOT visible |
| `EditorToolbar_Bold_WrapsSelectionInStrong` | Type text → select all → click Bold → text rendered inside `<strong>` |
| `EditorToolbar_Italic_WrapsSelectionInEm` | Type text → select all → click Italic → text rendered inside `<em>` |
| `EditorToolbar_Heading_AppliesH2` | Click H2 in toolbar → active block renders as `<h2>` |
| `EditorToolbar_Code_AppliesCodeMark` | Select text → click inline-code button → selection wrapped in `<code>` |

#### Page Statistics Footer

| Test | Journey |
|------|---------|
| `StatsFooter_ShowsBlockCount` | Open page with blocks → footer shows "N blocks" |
| `StatsFooter_UpdatesAfterAddingBlock` | Enter edit mode → add text block → save → footer block count increases |
| `StatsFooter_ShowsWordCount` | Open page with text → footer shows a non-zero word count |
| `StatsFooter_ShowsReadingTime` | Page with at least 250 words → footer shows "N min read" |

#### Export Markdown

| Test | Journey |
|------|---------|
| `ExportMarkdown_ButtonVisibleInViewMode` | Open any page → Export (download) button visible in header |
| `ExportMarkdown_ButtonVisibleInEditMode` | Enter edit mode → Export button still visible |

#### Inline Tag Filtering

| Test | Journey |
|------|---------|
| `InlineTagFilter_BarVisible_WhenPageHasInlineTags` | Open page that has inline tags in content → tag filter bar appears below toolbar |
| `InlineTagFilter_HidesNonMatchingBlocks` | Click an inline tag chip → blocks without that tag are hidden |
| `InlineTagFilter_ClearFilter_ShowsAllBlocks` | Click active chip again (deselect) or clear button → all blocks visible again |

#### Link Card Block

| Test | Journey |
|------|---------|
| `AddLinkCardBlock_ShowsUrlInput` | Enter edit mode → Add block → "Link" → URL input placeholder `Link URL…` visible |
| `AddLinkCardBlock_RendersCardAfterUrl` | Enter URL → card title/URL visible in rendered card |
| `AddLinkCardBlock_ExternalLinkOpensNewTab` | View mode → link `target="_blank"` and `rel="noopener noreferrer"` |

#### Audio Block

| Test | Journey |
|------|---------|
| `AddAudioBlock_ShowsAudioForm` | Enter edit mode → Add block → "Audio" → URL input visible |
| `AddAudioBlock_RendersPlayerAfterUrl` | Enter a valid audio URL → `<audio>` or media player element visible |

#### Keyboard Shortcuts

| Test | Journey |
|------|---------|
| `KeyboardShortcut_CtrlS_SavesPage` | Enter edit mode → make change → press Ctrl+S → app returns to view mode (Edit button visible) |

#### Block Actions Menu

| Test | Journey |
|------|---------|
| `BlockActionsMenu_IsAccessible` | Hover block → "Block actions" button (grip) becomes visible |
| `BlockActionsMenu_ContainsDeleteOption` | Open actions menu → "Delete block" menu item visible |
| `BlockActionsMenu_ContainsCopyOption` | Open actions menu → "Copy" or "Duplicate" menu item visible (if feature exists) |

---

## 7. Test Data Management

### Unit / Component tests

Each test renders fresh components with `vi.fn()` mocks — no shared state, no database. Tests are isolated by default.

### E2E tests

Each test class extends `E2ETestBase`, which launches a **fresh browser context** per test (via `[OneTimeSetUp]`). Each test creates its own pages via the UI (not a fixture file), so:

- Tests do not depend on pre-existing database rows.
- Tests do not interfere with each other.
- Tests clean up after themselves by nature (each context has its own user session seeded by `prisma/seed.ts`).

**The seed user:**

```
Email: test@devtree.io
Password: Test1234!
```

This user is created by `prisma/seed.ts` and is the only account used by E2E tests.

---

## 8. Running Tests

### Unit + Component tests (Vitest)

```bash
# Run all unit/component tests once
pnpm test

# Watch mode (re-runs on file change)
pnpm test:watch

# With coverage report
pnpm test:coverage
```

### E2E tests (Playwright / C#)

Prerequisites:
1. Start the app: `pnpm dev` (or `docker compose up -f docker-compose.dev.yml`)
2. Ensure the test database is seeded: `pnpm prisma:seed`

```bash
cd tests/e2e

# Run all e2e tests
dotnet test

# Run only Save tests
dotnet test --filter "Category=Save"

# Run only Editor tests
dotnet test --filter "Category=Editor"

# Run with headed browser (to watch actions)
dotnet test --settings .runsettings.headed
```

**Environment variable:**

```bash
# Point tests at a non-default URL
DEVTREE_BASE_URL=http://localhost:3001 dotnet test
```

---

## 9. Coverage Goals

| Area | Current | Target |
|------|---------|--------|
| Utility functions (`lib/`) | ~70% | 90% |
| Block components | ~60% | 80% |
| Page components (Login, Register) | ~50% | 70% |
| API routes | 0% | 60% |
| E2E user journeys | Core flows covered | All flows in §6 |

**What is NOT tested (and why):**

| Code | Reason not tested |
|------|-------------------|
| Tiptap rich-text internals | Third-party library — tested by Tiptap itself |
| Monaco Editor | Third-party library |
| Excalidraw rendering | Third-party library |
| CSS / Tailwind classes | Visual regression tests (Storybook) cover this |
| `prisma/schema.prisma` | Schema correctness verified by Prisma itself at migration time |
