# Meta Ads Dashboard

Painel de acompanhamento de campanhas de tráfego pago (Meta Ads) com funil de vendas
integrado à Hotmart e saúde de página via Microsoft Clarity. Feito em **Next.js**.

> Template genérico. Todos os dados e credenciais ficam em variáveis de ambiente —
> nenhuma conta, token ou senha está no código.

## O que ele mostra

- **Resumo de campanhas** — investimento, CPM, CTR, cliques, funil por anúncio
- **Funil** — visitas → conexão (connect rate) → checkout → compra
- **Vendas (Hotmart)** — cruzamento de vendas reais com origem de anúncio (via `sck`)
- **Saúde de página (Clarity)** — sessões, scroll, rage clicks
- **Leads / Seguidores / YouTube** — módulos opcionais

## Como rodar

```bash
# 1. instalar dependências
pnpm install        # ou npm install

# 2. configurar ambiente
cp .env.example .env.local
# edite .env.local com seus valores (veja comentários no arquivo)

# 3. rodar
pnpm dev
```

Abra http://localhost:3000. O acesso é protegido por uma senha simples
(`DASHBOARD_PASSWORD`) — defina a sua no `.env.local`.

### Modo demo (parcial)

Com `DEMO_MODE=true` no `.env.local`, as rotas de API (`/api/campaigns`,
`/api/insights`, `/api/funnel`, `/api/ads`, `/api/hotmart`, `/api/clarity`,
`/api/instagram`, `/api/youtube`, `/api/email-campaigns`) devolvem dados
fictícios e **nenhuma chamada externa é feita** — útil para explorar o código e
a navegação sem credenciais.

⚠️ O modo demo é **parcial**: os payloads de exemplo em `lib/demo-data.ts` não
cobrem todos os formatos que os componentes esperam, então várias seções ficam
em estado de carregamento. Para ver o painel populado de verdade, configure as
credenciais reais no `.env.local`. PRs melhorando o `demo-data.ts` são bem-vindos.

## Credenciais que você precisa criar

| Integração | Onde obter |
|---|---|
| **Meta Ads** | [developers.facebook.com](https://developers.facebook.com) → app com Marketing API → gerar `META_ACCESS_TOKEN` e pegar o `act_...` da sua conta |
| **Hotmart** | Painel Hotmart → Ferramentas → Credenciais API (Client ID + Secret) |
| **Clarity** | [clarity.microsoft.com](https://clarity.microsoft.com) → Settings → Data Export (API token) |
| YouTube / ActiveCampaign / Resend | opcionais — veja `.env.example` |

## Deploy

Pensado para **Vercel**. Configure as mesmas variáveis do `.env.example` em
Project → Settings → Environment Variables. O cron horário
(`.github/workflows/hourly-cron.yml`) faz um self-ping em `${{ vars.APP_URL }}/api/cron`
— defina a variável `APP_URL` e o secret `CRON_SECRET` no GitHub.

## Segurança

- Nunca comite `.env.local` nem `client_secret.json` (ambos no `.gitignore`).
- `META_ACCESS_TOKEN` e os secrets da Hotmart dão acesso à sua conta — trate como senha.

## Licença

MIT — use, adapte e compartilhe.
