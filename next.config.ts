import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't auto-generate AGENTS.md / CLAUDE.md on every dev start.
  agentRules: false,
};

export default nextConfig;
