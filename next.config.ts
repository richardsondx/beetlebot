import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Unsplash
      { protocol: "https", hostname: "images.unsplash.com" },
      // Pexels
      { protocol: "https", hostname: "images.pexels.com" },
      // placehold.co (no-key placeholder fallback)
      { protocol: "https", hostname: "placehold.co" },
      // Google Hotels / Google Images
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      // Booking.com, hotels.com CDNs
      { protocol: "https", hostname: "cf.bstatic.com" },
      { protocol: "https", hostname: "media-cdn.tripadvisor.com" },
    ],
  },
};

export default nextConfig;
