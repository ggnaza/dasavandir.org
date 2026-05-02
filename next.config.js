/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    staleTimes: { dynamic: 0 },
  },
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
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: *.supabase.co",
              "media-src 'self' blob: *.supabase.co https://drive.google.com",
              "font-src 'self'",
              "frame-src 'self' https://www.youtube.com https://player.vimeo.com https://drive.google.com https://docs.google.com https://challenges.cloudflare.com",
              "connect-src 'self' *.supabase.co wss://*.supabase.co https://api.openai.com https://challenges.cloudflare.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
