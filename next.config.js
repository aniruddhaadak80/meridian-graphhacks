/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  // FalkorDB clients talk to a server over RESP / unix sockets. Bundling them
  // is pointless and makes the build resolve native binaries, so keep them
  // external and load them at runtime only when actually connecting.
  serverExternalPackages: ["falkordb", "falkordblite"],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

module.exports = nextConfig;
