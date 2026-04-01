import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/pb/:path*",
        destination: "http://127.0.0.1:8090/:path*",
      },
    ];
  },
};

export default nextConfig;
