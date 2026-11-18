/** @type {import('next').NextConfig} */
// NEXT_PUBLIC_BASE_PATH is set by the GitHub Pages workflow (e.g. "/film-studio-companion"); empty for local use.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath || undefined,
};
export default nextConfig;
