import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // reactStrictMode disabled in dev to avoid double-rendering of the
  // simulation loop init effect, which can race with the WebSocket
  // connection. Re-enable for production builds.
  reactStrictMode: false,
  // Allow local development origins to load Next.js dev assets without
  // triggering cross-origin warnings. Add any preview gateway origin the
  // deployment platform assigns you (e.g. *.preview.example.com) here.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
  ],
  // Surface real type / lint errors during builds instead of silently
  // shipping broken code to judges.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Compress responses and strip the X-Powered-By header so the deployment
  // does not leak framework fingerprint info.
  compress: true,
  poweredByHeader: false,
  experimental: {
    // Optimise server-component boundaries for the API routes we ship.
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion"],
  },
};

export default nextConfig;
