/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mcpilot/core'],
  experimental: {
    // Allow server actions / server components to import the core lib directly.
  },
};

export default nextConfig;
