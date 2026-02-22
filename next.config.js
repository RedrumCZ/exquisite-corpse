// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allows cross-origin requests from LAN IPs during local dev
  // (only applies in `next dev`, ignored in production)
  allowedDevOrigins: [
    "192.168.0.177",   // update this if your local IP changes
  ],
};

export default nextConfig;
