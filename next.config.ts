import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortie autonome : `.next/standalone/server.js` embarque le serveur et les
  // seules dépendances réellement utilisées. Le LXC n'a donc pas besoin des
  // 797 Mo de node_modules pour servir, et le service démarre avec ~130 Mo.
  // Même choix que sw-coaching.
  output: "standalone",
};

export default nextConfig;
