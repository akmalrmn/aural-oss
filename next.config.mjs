/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    // Match the build worker count to the deployment runner to prevent
    // static-generation workers from exhausting memory on Node 18.
    cpus: 2,
    serverComponentsExternalPackages: [
      "pdf-parse",
      "ws",
      "bufferutil",
      "utf-8-validate",
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
