import type { NextConfig } from 'next';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const configDir = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = dirname(dirname(configDir));

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
