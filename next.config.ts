import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Драйвер базы содержит нативные модули: не упаковываем его, а подключаем из node_modules.
  serverExternalPackages: ["@libsql/client", "@libsql/core", "@libsql/hrana-client", "@libsql/isomorphic-ws", "libsql"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Микрофон нужен проверке произношения и Speaking; камера и геолокация не используются.
          { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
