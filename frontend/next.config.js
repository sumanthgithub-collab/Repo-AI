/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Allow images from GitHub avatars
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "github.com" },
    ],
  },

  // Proxy API calls to the Node.js gateway in development.
  // Keep rewrites disabled when gateway URL is not configured to avoid invalid
  // destinations during build ("undefined/api/:path*").
  async rewrites() {
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL;
    if (!gatewayUrl) return [];

    return [{
      source: "/api/:path*",
      destination: `${gatewayUrl}/api/:path*`,
    }];
  },
};

module.exports = nextConfig;
