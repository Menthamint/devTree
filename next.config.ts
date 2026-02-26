import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Required for Docker standalone deployment
  output: 'standalone',
  // Allow images from any HTTPS source (for the ImageBlock)
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  // Explicitly set the Turbopack workspace root to the project root so
  // Turbopack does not infer the 'app/' directory as the root, which causes
  // a build failure: "couldn't find next/package.json from ./app".
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
