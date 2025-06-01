import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const nextConfig: NextConfig = {
  // Existing config options will be preserved here if any were present
};

const pwaPlugin = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // runtimeCaching: [] // Example: add runtime caching strategies later if needed
});

export default pwaPlugin(nextConfig as any); // Type casting to 'any' to bypass type conflict
