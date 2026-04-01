import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const pbUrl = process.env.POCKETBASE_INTERNAL_URL || "http://127.0.0.1:8090";
    return [
      {
        source: "/pb/:path*",
        destination: `${pbUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
