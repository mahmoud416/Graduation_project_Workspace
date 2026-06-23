/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a self-contained server bundle for a small Docker image.
  output: 'standalone',
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
};

export default nextConfig;
