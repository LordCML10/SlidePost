/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent webpack from trying to bundle native .node binaries from @napi-rs/canvas.
  // These must be loaded at runtime by Node.js, not processed by webpack.
  serverExternalPackages: ['@napi-rs/canvas'],
};

export default nextConfig;
