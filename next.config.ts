import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Драйвер базы содержит нативные модули: не упаковываем его, а подключаем из node_modules.
  serverExternalPackages: ["@libsql/client", "@libsql/core", "@libsql/hrana-client", "@libsql/isomorphic-ws", "libsql"],
};

export default nextConfig;
