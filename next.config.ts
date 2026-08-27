import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "pg",
    "@prisma/adapter-pg",
    "bcryptjs",
  ],
};

export default nextConfig;
