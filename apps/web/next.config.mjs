/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@hub/ai", "@hub/domain", "@hub/providers", "@hub/queue", "@hub/db"],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
