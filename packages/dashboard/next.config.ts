import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /** Transpile the workspace core package */
  transpilePackages: ['@phalanx/core'],
  /** Use server-external packages that rely on native bindings */
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
