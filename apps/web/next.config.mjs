/** @type {import('next').NextConfig} */
const nextConfig = {
transpilePackages: ["@hub/ai", "@hub/domain", "@hub/providers", "@hub/queue"]
};

export default nextConfig;
