/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ hostname: "*.supabase.co" }],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: *.supabase.co",
              "media-src 'self' blob:",
              "font-src 'self'",
              "frame-src 'self' https://www.youtube.com https://player.vimeo.com",
              "connect-src 'self' *.supabase.co wss://*.supabase.co https://api.openai.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
