import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth/password';

const prisma = new PrismaClient();

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
    where: { id: 'seed-folder-frontend' },
    update: { name: 'Frontend' },
    create: {
      id: 'seed-folder-frontend',
      name: 'Frontend',
      order: 0,
      ownerId: user.id,
    },
  });

  const backendFolder = await prisma.folder.upsert({
    where: { id: 'seed-folder-backend' },
    update: { name: 'Backend' },
    create: {
      id: 'seed-folder-backend',
      name: 'Backend',
      order: 1,
      ownerId: user.id,
    },
  });

  console.log('Folders:', frontendFolder.name, backendFolder.name);

  // ── Cleanup: delete non-seed pages and folders created by tests ───────────────
  const seedPageIds = ['seed-react-hooks', 'seed-typescript', 'seed-rest-api', 'seed-getting-started'];
  const seedFolderIds = ['seed-folder-frontend', 'seed-folder-backend'];

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
    where: { id: 'seed-react-hooks' },
    update: { title: 'React Hooks', tags: ['react', 'hooks'], folderId: 'seed-folder-frontend' },
    create: {
      id: 'seed-react-hooks',
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
    where: { id: 'seed-typescript' },
    update: { title: 'TypeScript Tips', tags: ['typescript'], folderId: 'seed-folder-frontend' },
    create: {
      id: 'seed-typescript',
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
    where: { id: 'seed-rest-api' },
    update: { title: 'REST API Design', tags: ['api', 'backend'], folderId: 'seed-folder-backend' },
    create: {
      id: 'seed-rest-api',
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
    where: { id: 'seed-getting-started' },
    update: { title: 'Getting Started', tags: [], folderId: null },
    create: {
      id: 'seed-getting-started',
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
  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
