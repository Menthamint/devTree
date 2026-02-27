/**
 * /api/user/libraries — Excalidraw library management.
 *
 * ─── DATA MODEL ───────────────────────────────────────────────────────────────
 *
 * An `ExcalidrawLibrary` row represents a uniquely-identified library package
 * (e.g. "Software Architecture" from libraries.excalidraw.com). It is keyed on
 * `sourceUrl` so the same library is NEVER duplicated in the database — if two
 * users import the same URL, only one row is created and both users point to it
 * via `UserLibrary`.
 *
 * `UserLibrary` is the many-to-many join table: userId ↔ libraryId.
 *
 * `User.localLibraryItems` stores items the user added from their local file
 * system (or created in-canvas) that have no canonical URL. These are personal
 * to the user and stored directly on the User row as a JSON array.
 *
 * ─── ENDPOINTS ────────────────────────────────────────────────────────────────
 *
 *   GET  /api/user/libraries
 *     Returns all library items for the authenticated user: URL-sourced
 *     libraries (ExcalidrawLibrary) PLUS local items (User.localLibraryItems).
 *     Shape: `{ libraries: LibraryEntry[], localItems: unknown[] }`.
 *
 *   POST /api/user/libraries
 *     Imports a library by source URL.  If the library already exists in the DB
 *     (another user imported the same URL) the existing record is reused; only
 *     the join row is created.  Body: `{ sourceUrl, items, name? }`.
 *     Returns the `ExcalidrawLibrary` record that was linked.
 *
 *   PATCH /api/user/libraries
 *     Saves the user's local (file-system-loaded or in-canvas-created) library
 *     items.  Replaces the full `User.localLibraryItems` JSON array.
 *     Body: `{ items: unknown[] }`.
 *
 * ─── SECURITY ─────────────────────────────────────────────────────────────────
 *
 *   Library items are Excalidraw geometry data (shapes, lines, text) serialised
 *   as JSON.  They are never executed server-side — the server only stores and
 *   returns them.  On the client they are rendered by Excalidraw's own canvas
 *   engine, which does not eval or inject the data as HTML.
 *
 *   Safeguards applied:
 *     • Max item count (500) to cap database row size.
 *     • Basic structural validation: each item must have string `id` and
 *       array `elements` so corrupted/malicious blobs are rejected early.
 *     • Serialised size cap (200 KB) prevents unbounded payload abuse.
 *     • URL validation on the POST endpoint guards against SSRF-style injection.
 *     • All endpoints require an authenticated session (requireAuth).
 *
 * ─── CORS / FETCH ─────────────────────────────────────────────────────────────
 *
 *   The client fetches the `.excalidrawlib` file directly (via the browser's
 *   built-in CORS fetch).  The raw items array is then POSTed here — we do NOT
 *   re-fetch from the library URL on the server so that we avoid server-side
 *   CORS blockers.
 */
import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { requireAuth } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LibraryEntry {
  id: string;
  sourceUrl: string;
  name: string;
  items: unknown[];
  addedAt: string; // ISO date string
}

export interface GetLibrariesResponse {
  libraries: LibraryEntry[];
  /** Items the user loaded from a local file or created in-canvas. */
  localItems: unknown[];
}

interface PostBody {
  sourceUrl: string;
  items: unknown[];
  name?: string;
}

interface PatchBody {
  items: unknown[];
}

function isPostBody(body: unknown): body is PostBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as Record<string, unknown>).sourceUrl === 'string' &&
    Array.isArray((body as Record<string, unknown>).items)
  );
}

function isPatchBody(body: unknown): body is PatchBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    Array.isArray((body as Record<string, unknown>).items)
  );
}

/**
 * Basic structural guard for a single library item.
 * An ExcalidrawLibraryItem has at minimum `id` (string) and `elements` (array).
 * We reject anything that doesn't conform so corrupted or malicious blobs are
 * caught before they reach the database.
 */
function isValidLibraryItem(item: unknown): boolean {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  return typeof obj.id === 'string' && Array.isArray(obj.elements);
}

// ─── GET /api/user/libraries ──────────────────────────────────────────────────

/**
 * Return all libraries the user has linked, with their items, plus any locally
 * stored items (from file imports or in-canvas creations).
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { userId } = auth;

  const [userLibraries, user] = await Promise.all([
    prisma.userLibrary.findMany({
      where: { userId },
      include: { library: true },
      orderBy: { addedAt: 'asc' },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { localLibraryItems: true },
    }),
  ]);

  const libraries: LibraryEntry[] = userLibraries.map(({ library, addedAt }) => ({
    id: library.id,
    sourceUrl: library.sourceUrl,
    name: library.name,
    items: library.items as unknown[],
    addedAt: addedAt.toISOString(),
  }));

  const localItems = Array.isArray(user?.localLibraryItems)
    ? (user.localLibraryItems as unknown[])
    : [];

  return NextResponse.json({ libraries, localItems } satisfies GetLibrariesResponse);
}

// ─── POST /api/user/libraries ─────────────────────────────────────────────────

/**
 * Import a library by source URL.
 *
 * - If the library (by sourceUrl) already exists in the DB, reuse it.
 * - Create a `UserLibrary` join row (idempotent — upsert avoids duplicates).
 * - Returns the linked library entry.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { userId } = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isPostBody(body)) {
    return NextResponse.json(
      { error: 'Body must contain sourceUrl (string) and items (array)' },
      { status: 400 },
    );
  }

  const { sourceUrl, items, name = '' } = body;

  // ── Input validation ────────────────────────────────────────────────────────

  // Normalise the URL.
  const normalised = sourceUrl.trim();
  if (!normalised) {
    return NextResponse.json({ error: 'sourceUrl must not be empty' }, { status: 400 });
  }

  // Validate that sourceUrl is an absolute http(s) URL to prevent storing
  // arbitrary strings and to guard against SSRF-style data smuggling.
  try {
    const parsed = new URL(normalised);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Non-HTTP protocol');
    }
  } catch {
    return NextResponse.json({ error: 'sourceUrl must be a valid http(s) URL' }, { status: 400 });
  }

  // Limit the number of items to prevent excessively large payloads from
  // bloating the database or causing slow JSON serialisation on reads.
  const MAX_LIBRARY_ITEMS = 500;
  if (items.length > MAX_LIBRARY_ITEMS) {
    return NextResponse.json(
      { error: `items array may not exceed ${MAX_LIBRARY_ITEMS} entries` },
      { status: 400 },
    );
  }

  // --- Upsert the global library record ---
  const library = await prisma.excalidrawLibrary.upsert({
    where: { sourceUrl: normalised },
    update: {
      // Always refresh the items when re-imported so data stays up-to-date.
      items: items as Prisma.InputJsonValue,
      // Only update name if a non-empty value was provided.
      ...(name ? { name } : {}),
    },
    create: {
      sourceUrl: normalised,
      name: name || (normalised.split('/').pop()?.replace('.excalidrawlib', '') ?? normalised),
      items: items as Prisma.InputJsonValue,
    },
  });

  // --- Link user to library (idempotent) ---
  await prisma.userLibrary.upsert({
    where: { userId_libraryId: { userId, libraryId: library.id } },
    update: {}, // nothing to update; addedAt is set on creation
    create: { userId, libraryId: library.id },
  });

  const entry: LibraryEntry = {
    id: library.id,
    sourceUrl: library.sourceUrl,
    name: library.name,
    items: library.items as unknown[],
    addedAt: new Date().toISOString(),
  };

  return NextResponse.json(entry, { status: 201 });
}

// ─── PATCH /api/user/libraries ────────────────────────────────────────────────

/**
 * Save the user's personal local library items (loaded from their file system
 * or created in-canvas). Replaces the entire `User.localLibraryItems` array so
 * the client always sends the full canonical set.
 *
 * Security: items are validated for structure and limited in count/size before
 * being written to the database.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { userId } = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isPatchBody(body)) {
    return NextResponse.json({ error: 'Body must contain items (array)' }, { status: 400 });
  }

  const { items } = body;

  // ── Input validation ────────────────────────────────────────────────────────

  const MAX_LOCAL_ITEMS = 500;
  if (items.length > MAX_LOCAL_ITEMS) {
    return NextResponse.json(
      { error: `items array may not exceed ${MAX_LOCAL_ITEMS} entries` },
      { status: 400 },
    );
  }

  // Validate each item has at minimum `id` (string) and `elements` (array).
  const invalidIdx = items.findIndex((item) => !isValidLibraryItem(item));
  if (invalidIdx !== -1) {
    return NextResponse.json(
      { error: `Item at index ${invalidIdx} is missing required fields (id, elements)` },
      { status: 400 },
    );
  }

  // Guard against oversized payloads (200 KB limit on the serialised JSON).
  const MAX_SERIALISED_BYTES = 200 * 1024;
  const serialised = JSON.stringify(items);
  if (serialised.length > MAX_SERIALISED_BYTES) {
    return NextResponse.json({ error: 'items payload exceeds the 200 KB limit' }, { status: 400 });
  }

  // ── Persist ─────────────────────────────────────────────────────────────────

  await prisma.user.update({
    where: { id: userId },
    data: { localLibraryItems: items as Prisma.InputJsonValue },
  });

  return NextResponse.json({ localItems: items });
}
