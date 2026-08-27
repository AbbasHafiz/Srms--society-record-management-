import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow client JS/HMR when previewing via 127.0.0.1 or Cloudflare quick tunnels.
  allowedDevOrigins: ["127.0.0.1", "*.trycloudflare.com"],
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "pg",
    "@prisma/adapter-pg",
    "bcryptjs",
  ],
};

export default nextConfig;
