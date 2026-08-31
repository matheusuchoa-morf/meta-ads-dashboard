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

> Leia também **Configuração obrigatória** (seção 2) — sem ela o painel abre vazio.

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

## 1. Credenciais que você precisa criar

Requer **Node 20+**.

| Integração | Onde obter | Obrigatória? |
|---|---|---|
| **Meta Ads** | [developers.facebook.com](https://developers.facebook.com) → app com Marketing API → `META_ACCESS_TOKEN` + o `act_...` da sua conta | ✅ sim |
| **Hotmart** | Painel Hotmart → Ferramentas → Credenciais API (Client ID + Secret) | para vendas/receita |
| **Clarity** | [clarity.microsoft.com](https://clarity.microsoft.com) → Settings → Data Export (API token) | para saúde de página |
| YouTube / ActiveCampaign / Resend / Telegram / Discord | veja `.env.example` | opcionais |

**Sobre o token da Meta:**
- Permissões: `ads_read` para ler; **`ads_management`** também, se quiser usar os
  botões de pausar/ativar campanha e anúncio dentro do painel.
- `META_AD_ACCOUNT_ID` vai **com o prefixo `act_`** (ex.: `act_1234567890`).
- Tokens de usuário expiram. Para produção, gere um **token de longa duração**
  (ou de System User no Business Manager) — senão o painel para de responder em
  poucas horas.

## 2. Configuração obrigatória (dentro do código)

⚠️ **Só preencher o `.env.local` não basta.** O painel foi extraído de uma
operação real e alguns mapeamentos são específicos do seu negócio. Sem ajustar
os arquivos abaixo, o painel abre — mas várias seções ficam vazias.

| Arquivo | O que ajustar | Se você não ajustar |
|---|---|---|
| `lib/campaign-classifier.ts` | As `keywords` que casam com o **nome das suas campanhas** no Meta | Toda campanha cai em "Outros" e os filtros ficam vazios |
| `app/page.tsx` → `TAG_OPTIONS` | Os rótulos do seletor de produto/edição | Filtros mostram nomes de exemplo |
| `app/api/clarity/route.ts` → `TRACKED_PAGES` | As URLs reais das suas landing pages | Aba de saúde de página vem vazia |
| `lib/lp-mapping.ts` | Seus slugs de LP, ganchos de anúncio e regras de congruência | Análise ad↔LP fica sem sentido |
| `lib/followers-tof-data.ts` | Snapshot **manual** (a Graph API não expõe seguidores por anúncio) | Aba Seguidores mostra dados de exemplo |
| `.env.local` → `NEXT_PUBLIC_GOAL_*` | Suas metas de venda e a data de corte | Metas mostram 100 por padrão |

### Atribuição venda ↔ anúncio (o passo que quase todo mundo esquece)

O cruzamento "esta venda veio deste anúncio" **não** usa o pixel da Meta (que
super-atribui). Ele lê o campo `sck` que a Hotmart devolve na venda, no formato:

```
facebook|paid|<campanha>|<adset>|<anuncio>
```

Para isso funcionar, **a sua landing page precisa repassar os parâmetros de
UTM/ad para o link do checkout da Hotmart como `sck`** — isso é configuração da
sua página, fora deste projeto. Sem esse repasse, toda venda aparece como
orgânica e a coluna de origem por anúncio fica vazia.

### Webhook da Hotmart (opcional)

Para receber vendas em tempo real, aponte um webhook da Hotmart para
`https://seu-dominio.com/api/hotmart/webhook` e defina `HOTMART_HOTTOK` no
ambiente (o endpoint valida esse token).

## 3. Deploy

Pensado para **Vercel**. Configure as mesmas variáveis do `.env.example` em
Project → Settings → Environment Variables.

### Cron horário (opcional, vem desligado)

`.github/workflows/hourly-cron.yml` faz um self-ping em `/api/cron` de hora em
hora (é o que dispara as regras de stop-loss e as notificações). **O agendamento
vem comentado de propósito** — um fork sem configuração ficaria falhando toda
hora. Para ligar:

1. Settings → Secrets and variables → Actions → **Variables** → crie `APP_URL`
   = `https://seu-dominio.com` (sem barra no final)
2. Aba **Secrets** → crie `CRON_SECRET` (mesmo valor da env var do deploy)
3. Descomente o bloco `schedule:` no workflow

Sem `APP_URL`, o job apenas emite um aviso e passa — não falha.

## 4. Segurança

- Nunca comite `.env.local` nem `client_secret.json` (ambos no `.gitignore`).
- `META_ACCESS_TOKEN` e os secrets da Hotmart dão acesso à sua conta — trate como senha.

## Licença

MIT — use, adapte e compartilhe.
