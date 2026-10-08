import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't auto-generate AGENTS.md / CLAUDE.md on every dev start.
  agentRules: false,
  async rewrites() {
    return [{ source: "/library", destination: "/vicolo-library/index.html" }];
  },
};

export default nextConfig;
