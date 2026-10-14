/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // O painel das TVs continua sendo o mesmo index.html estático de sempre, na
  // raiz: as TVs abrem `ranking.muranoprofessional.com.br/` (com ou sem `?dia=`)
  // e nada muda para elas. O Next só acrescenta /controle, /api e /auth.
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/index.html" }] };
  },
  async headers() {
    return [
      {
        // Quem pode abrir o Ranking num iframe: o hub, o Pulse e o VendasPro.
        source: "/:caminho*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://app.muranoprofessional.com.br https://*.muranoprofessional.com.br https://murano-vendaspro.vercel.app",
          },
        ],
      },
    ];
  },
};
export default nextConfig;
