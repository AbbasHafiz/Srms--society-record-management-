import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  // Allow client JS/HMR when previewing via 127.0.0.1 or Cloudflare quick tunnels.
  allowedDevOrigins: ["127.0.0.1", "*.trycloudflare.com"],
  experimental: {
    serverActions: {
      bodySizeLimit: "512mb",
    },
  },
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "pg",
    "@prisma/adapter-pg",
    "bcryptjs",
    "exceljs",
  ],
};

export default withSerwist(nextConfig);
