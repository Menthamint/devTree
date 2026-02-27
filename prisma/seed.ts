import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth/password';

const prisma = new PrismaClient();

const SEED_FOLDER_IDS = {
  frontend: 'seed-folder-frontend',
  backend: 'seed-folder-backend',
} as const;

const SEED_PAGE_IDS = {
  reactHooks: 'seed-react-hooks',
  typescriptTips: 'seed-typescript',
  restApiDesign: 'seed-rest-api',
  gettingStarted: 'seed-getting-started',
} as const;

async function main() {
  console.log('Seeding database...');
  const demoPassword = process.env.DEMO_PASSWORD ?? 'E2E!Passw0rd123';

  // ── Admin account (optional, only when ADMIN_PASSWORD is set) ───────────────
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@localhost').trim().toLowerCase();
  if (adminPassword && adminEmail) {
    const hashed = await hashPassword(adminPassword);
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { password: hashed, name: process.env.ADMIN_NAME ?? 'Admin' },
      create: {
        email: adminEmail,
        password: hashed,
        name: process.env.ADMIN_NAME ?? 'Admin',
      },
    });
    console.log('Admin account:', admin.email);
  } else {
    console.log('Skipping admin account (ADMIN_PASSWORD not set).');
  }

  // ── Demo user ────────────────────────────────────────────────────────────────
  const hashedDemoPassword = await hashPassword(demoPassword);
  const user = await prisma.user.upsert({
    where: { email: 'demo@devtree.local' },
    update: {
      password: hashedDemoPassword,
      name: 'Demo User',
      // Reset preferences to English so E2E tests always start in the correct locale.
      preferences: { locale: 'en', theme: 'light' },
    },
    create: {
      email: 'demo@devtree.local',
      password: hashedDemoPassword,
      name: 'Demo User',
      preferences: { locale: 'en', theme: 'light' },
    },
  });
  console.log('Demo user:', user.email);

  // ── Folders ──────────────────────────────────────────────────────────────────
  const frontendFolder = await prisma.folder.upsert({
    where: { id: SEED_FOLDER_IDS.frontend },
    update: { name: 'Frontend' },
    create: {
      id: SEED_FOLDER_IDS.frontend,
      name: 'Frontend',
      order: 0,
      ownerId: user.id,
    },
  });

  const backendFolder = await prisma.folder.upsert({
    where: { id: SEED_FOLDER_IDS.backend },
    update: { name: 'Backend' },
    create: {
      id: SEED_FOLDER_IDS.backend,
      name: 'Backend',
      order: 1,
      ownerId: user.id,
    },
  });

  console.log('Folders:', frontendFolder.name, backendFolder.name);

  // ── Cleanup: delete non-seed pages and folders created by tests ───────────────
  const seedPageIds = [
    SEED_PAGE_IDS.reactHooks,
    SEED_PAGE_IDS.typescriptTips,
    SEED_PAGE_IDS.restApiDesign,
    SEED_PAGE_IDS.gettingStarted,
  ];
  const seedFolderIds = [SEED_FOLDER_IDS.frontend, SEED_FOLDER_IDS.backend];

  const deletedPages = await prisma.page.deleteMany({
    where: {
      ownerId: user.id,
      id: { notIn: seedPageIds },
    },
  });
  const deletedFolders = await prisma.folder.deleteMany({
    where: {
      ownerId: user.id,
      id: { notIn: seedFolderIds },
    },
  });
  if (deletedPages.count > 0 || deletedFolders.count > 0) {
    console.log(`Cleaned up: ${deletedPages.count} non-seed pages, ${deletedFolders.count} non-seed folders`);
  }

  // ── Pages ─────────────────────────────────────────────────────────────────────

  const reactPage = await prisma.page.upsert({
    where: { id: SEED_PAGE_IDS.reactHooks },
    update: {
      title: 'React Hooks',
      tags: ['react', 'hooks'],
      folderId: SEED_FOLDER_IDS.frontend,
    },
    create: {
      id: SEED_PAGE_IDS.reactHooks,
      title: 'React Hooks',
      order: 0,
      tags: ['react', 'hooks'],
      ownerId: user.id,
      folderId: frontendFolder.id,
      blocks: {
        create: [
          {
            type: 'text',
            order: 0,
            colSpan: 2,
            content:
              '<h2>What are React Hooks?</h2><p>React Hooks allow you to use <strong>state</strong> and other React features in functional components.</p>',
          },
          {
            type: 'code',
            order: 1,
            colSpan: 2,
            content: {
              code: 'const [count, setCount] = useState(0);',
              language: 'javascript',
            },
          },
          {
            type: 'table',
            order: 2,
            colSpan: 2,
            content: {
              headers: ['Hook', 'Purpose'],
              rows: [
                ['useState', 'Manage local state'],
                ['useEffect', 'Side effects'],
                ['useContext', 'Consume context'],
              ],
            },
          },
        ],
      },
    },
  });

  const tsPage = await prisma.page.upsert({
    where: { id: SEED_PAGE_IDS.typescriptTips },
    update: {
      title: 'TypeScript Tips',
      tags: ['typescript'],
      folderId: SEED_FOLDER_IDS.frontend,
    },
    create: {
      id: SEED_PAGE_IDS.typescriptTips,
      title: 'TypeScript Tips',
      order: 1,
      tags: ['typescript'],
      ownerId: user.id,
      folderId: frontendFolder.id,
      blocks: {
        create: [
          {
            type: 'text',
            order: 0,
            colSpan: 2,
            content:
              '<h2>TypeScript Best Practices</h2><p>TypeScript adds <strong>static typing</strong> to JavaScript, catching errors at compile-time.</p>',
          },
          {
            type: 'agenda',
            order: 1,
            colSpan: 2,
            content: {
              title: 'Must-know patterns',
              items: [
                { id: 'ts1', text: 'Enable strict mode', checked: true },
                { id: 'ts2', text: 'Use utility types: Partial, Pick, Omit', checked: false },
                { id: 'ts3', text: 'Prefer const assertions', checked: false },
              ],
            },
          },
        ],
      },
    },
  });

  const apiPage = await prisma.page.upsert({
    where: { id: SEED_PAGE_IDS.restApiDesign },
    update: {
      title: 'REST API Design',
      tags: ['api', 'backend'],
      folderId: SEED_FOLDER_IDS.backend,
    },
    create: {
      id: SEED_PAGE_IDS.restApiDesign,
      title: 'REST API Design',
      order: 0,
      tags: ['api', 'backend'],
      ownerId: user.id,
      folderId: backendFolder.id,
      blocks: {
        create: [
          {
            type: 'text',
            order: 0,
            colSpan: 2,
            content:
              '<h2>REST API Best Practices</h2><p>Design clear, consistent REST endpoints using proper HTTP verbs and status codes.</p>',
          },
          {
            type: 'table',
            order: 1,
            colSpan: 2,
            content: {
              headers: ['Method', 'Purpose', 'Status'],
              rows: [
                ['GET', 'Read resource', '200'],
                ['POST', 'Create resource', '201'],
                ['PUT', 'Replace resource', '200'],
                ['DELETE', 'Remove resource', '204'],
              ],
            },
          },
        ],
      },
    },
  });

  // Root-level page (no folder)
  const gettingStartedPage = await prisma.page.upsert({
    where: { id: SEED_PAGE_IDS.gettingStarted },
    update: { title: 'Getting Started', tags: [], folderId: null },
    create: {
      id: SEED_PAGE_IDS.gettingStarted,
      title: 'Getting Started',
      order: 0,
      tags: [],
      ownerId: user.id,
      folderId: null,
      blocks: {
        create: [
          {
            type: 'text',
            order: 0,
            colSpan: 2,
            content:
              '<h2>Welcome to devTree!</h2><p>Use the sidebar to create pages and folders. Click a page to start editing.</p>',
          },
        ],
      },
    },
  });

  console.log(
    'Pages created:',
    reactPage.title,
    tsPage.title,
    apiPage.title,
    gettingStartedPage.title,
  );

  // ── Motivation messages ───────────────────────────────────────────────────
  // Idempotent: only insert the seed rows when the table is empty so a
  // re-seed does not wipe admin-added messages.
  const existingCount = await prisma.motivationMessage.count();
  if (existingCount === 0) {
    const dailyMessages = [
      { text: 'Every note you write is a thought made permanent.', emoji: '✍️' },
      { text: "Knowledge compounds just like interest. You're investing in yourself.", emoji: '📈' },
      { text: 'The act of writing clarifies thinking. Keep going.', emoji: '💡' },
      { text: 'Small, consistent steps outperform long occasional bursts.', emoji: '🐢' },
      { text: "Your notes today are the shortcuts you'll thank yourself for tomorrow.", emoji: '🗺️' },
      { text: "A second brain starts with a single note. You've already started.", emoji: '🧠' },
      { text: 'Deep work leaves a trace. Your blocks are proof.', emoji: '🔬' },
      { text: 'Reviewing old notes once is worth writing them ten times.', emoji: '🔁' },
      { text: "Curiosity is a muscle. You're exercising it right now.", emoji: '💪' },
      { text: 'The best time to document something is right now.', emoji: '⏱️' },
      { text: 'Connecting ideas is the highest form of learning.', emoji: '🕸️' },
      { text: 'Great notes are great questions in disguise.', emoji: '❓' },
      { text: "You don't have to remember everything — your notes do.", emoji: '📦' },
      { text: "Progress is invisible until suddenly it isn't.", emoji: '🌅' },
      { text: 'Structured thinking starts with structured notes.', emoji: '🏗️' },
      { text: 'Each block you write is a brick in your knowledge base.', emoji: '🧱' },
      { text: "The learner's advantage: you never stop improving.", emoji: '🎓' },
      { text: "Document the 'why' as much as the 'how'.", emoji: '🗺️' },
      { text: "What you write today, you'll understand better next week.", emoji: '📆' },
      { text: 'Habits beat motivation. Your streak is proof of that.', emoji: '🔥' },
      { text: 'Consistency is the compound interest of personal growth.', emoji: '📊' },
      { text: 'Your notes are your thinking made visible.', emoji: '👁️' },
      { text: 'The best learning tool is the one you actually use.', emoji: '🛠️' },
      { text: 'Even five minutes of focused writing moves the needle.', emoji: '📍' },
      { text: 'Capture ideas fast. Refine them later. Ship knowledge today.', emoji: '🚀' },
      { text: "Writing is thinking. You're doing both right now.", emoji: '🤔' },
      { text: 'Build in public starts with building in your notes.', emoji: '🏛️' },
      { text: 'Every expert started by taking notes on the basics.', emoji: '📝' },
      { text: 'Your knowledge base grows every time you open the app.', emoji: '🌱' },
      { text: "Today's note is tomorrow's shortcut.", emoji: '⚡' },
    ];

    const achievementMessages = [
      {
        achievementId: 'streak-100',
        text: '100-day streak! You are a true learning champion.',
        emoji: '🏆',
      },
      {
        achievementId: 'streak-30',
        text: "30 days in a row — you're unstoppable.",
        emoji: '⚡',
      },
      {
        achievementId: 'streak-7',
        text: '7-day streak! Consistency is the superpower of learners.',
        emoji: '🔥',
      },
      {
        achievementId: '50-pages',
        text: '50 notes — your second brain is growing strong.',
        emoji: '🧠',
      },
      {
        achievementId: '10-pages',
        text: "10 notes in! You're building a real knowledge base.",
        emoji: '📚',
      },
      {
        achievementId: 'first-page',
        text: "You've created your first note! The journey of a thousand pages begins with one.",
        emoji: '🌱',
      },
    ];

    await prisma.motivationMessage.createMany({
      data: [
        ...dailyMessages.map((m, i) => ({ type: 'daily', order: i, ...m })),
        ...achievementMessages.map((m, i) => ({ type: 'achievement', order: i, ...m })),
      ],
    });
    console.log(
      `Motivation messages seeded: ${dailyMessages.length} daily + ${achievementMessages.length} achievement.`,
    );
  } else {
    console.log(`Motivation messages already present (${existingCount} rows) — skipping seed.`);
  }

  console.log('Seeding complete.');
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
