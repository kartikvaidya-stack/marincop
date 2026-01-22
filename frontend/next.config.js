/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep both roots identical to avoid Vercel build/runtime issues
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
