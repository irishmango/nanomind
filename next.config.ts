import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  reactCompiler: true,
  serverExternalPackages: ['pdf-parse', '@anthropic-ai/sdk', '@langchain/anthropic', '@langchain/community', '@langchain/openai', '@langchain/textsplitters', '@langchain/core', 'langchain'],
};

export default nextConfig;
