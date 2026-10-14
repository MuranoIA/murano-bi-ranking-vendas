# Ranking de vendas — Murano

Sistema próprio do Ranking (`ranking.muranoprofessional.com.br`, Vercel). Saiu de
dentro do Pulse em 14/10/2026 (Café Code, demanda #1 do VendasPro).

| caminho | o que é |
|---|---|
| `/` | painel das TVs — o mesmo `public/index.html` estático de antes (aceita `?dia=AAAA-MM-DD`) |
| `/controle` | as 7 abas que moravam no Pulse: Ao vivo, Por dia, Minha foto, Filiais, Metas, TVs, Música |
| `/api/*` | as rotas que o Pulse tinha (`/api/ranking/*`, `/api/meta`, `/api/foto`) |
| `/auth/hub-sso` | entrada vinda do hub |

## Login: sempre o do hub

A tela abre em iframe no hub (módulo Ranking), no Pulse e no VendasPro. Sem
sessão, `/controle` manda o quadro para `app.muranoprofessional.com.br/ranking/sso`,
que confere o login do hub e devolve um passe assinado (HMAC, 60 s) para
`/auth/hub-sso`. O papel vem da tabela `acesso` do banco do CRM: **admin lá é
admin aqui** (Por dia, Filiais, Metas, TVs, Música); a carteira diz de quem é a
"Minha foto". A sessão é um cookie assinado de 8 h (`rk_sessao`, SameSite=None,
Partitioned).

## Variáveis (Vercel)

| nome | valor |
|---|---|
| `SUPABASE_URL` | banco do CRM (`https://wtunzezigncwjpcqsfzk.supabase.co`) — o mesmo do Pulse |
| `SUPABASE_SERVICE_ROLE_KEY` | a mesma do Pulse |
| `RANKING_HUB_SSO_SECRET` | segredo compartilhado com o hub (igual nas duas Vercel) |
| `RANKING_SESSAO_SECRET` | opcional; assina o cookie (sem ele, usa o de cima) |
| `HUB_URL` | opcional; padrão `https://app.muranoprofessional.com.br` |

Os dados não mudaram de lugar: `bi_config`, `bi_fotos_ranking`, os buckets
`ranking-fotos`/`ranking-musica` e a edge function `bi-ranking-vendas` seguem no
banco do CRM.

## Rodar local

```bash
npm install
npm run dev   # http://localhost:3200 (painel) e /controle
```
