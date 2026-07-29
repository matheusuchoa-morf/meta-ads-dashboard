// lib/followers-tof-data.ts
// ─────────────────────────────────────────────────────────────────────────────
// Snapshot VERIFICADO do ToF "[Trafego] [seguidores] - Imersão Claude"
// (campanha YOUR_CAMPAIGN_ID, objetivo PROFILE_VISIT). Dois recortes por
// anúncio: HOJE e LIFETIME (acumulado), pro toggle da aba Seguidores.
//
// POR QUE ESTÁTICO: o Meta NÃO expõe "Seguidores no Instagram" por anúncio na
// Graph API — só na UI do Ads Manager (view "Distribuição Para Seguidores").
// Então seguidores são lidos da UI. Gasto/checkout/compras vêm da API; visitas
// no LIFETIME usam "Visitas ao perfil" (UI), e em ads novos/HOJE caem pro
// cliques-no-link (proxy) até a próxima leitura da UI.
//
// COMO ATUALIZAR (a cada "os dados do ToF"):
//   1. Ads Manager, campanha YOUR_CAMPAIGN_ID, view "Distribuição Para
//      Seguidores": ler com date=Hoje e com date=Máximo (Visitas perfil + Seguidores).
//      URL: .../manage/ads?act=YOUR_AD_ACCOUNT_ID&selected_campaign_ids=YOUR_CAMPAIGN_ID&date=AAAA-MM-DD_AAAA-MM-DD
//   2. Gasto/checkout/compras: API insights (date_preset today + maximum).
//   3. Reescrever today/lifetime de cada row + updatedAt. status:'active' nos que rodam.
// ─────────────────────────────────────────────────────────────────────────────

export type TofAdStatus = 'active' | 'paused'
export type TofPeriod = 'today' | 'lifetime'

export interface TofMetrics {
  spend: number          // R$ investido
  profileVisits: number  // Visitas ao perfil do Instagram (lifetime=UI; novos/hoje=cliques no link)
  followers: number      // Seguidores no Instagram (UI)
  checkout: number       // onsite_web_initiate_checkout
  purchases: number      // compras (pixel)
}

export interface TofFollowerRow {
  adName: string
  status: TofAdStatus
  today: TofMetrics
  lifetime: TofMetrics
}

export interface TofFollowersSnapshot {
  campaignId: string
  campaignName: string
  todayLabel: string
  lifetimeLabel: string
  followersNote: string
  updatedAt: string      // ISO date (YYYY-MM-DD)
  metaUrl: string
  rows: TofFollowerRow[]
}

const Z: TofMetrics = { spend: 0, profileVisits: 0, followers: 0, checkout: 0, purchases: 0 }
const m = (spend: number, profileVisits: number, followers: number, checkout: number, purchases: number): TofMetrics =>
  ({ spend, profileVisits, followers, checkout, purchases })

export const TOF_FOLLOWERS: TofFollowersSnapshot = {
  campaignId: 'YOUR_CAMPAIGN_ID',
  campaignName: '[Trafego] [seguidores] - Sua Campanha',
  todayLabel: 'Hoje',
  lifetimeLabel: 'Lifetime',
  followersNote:
    'Visitas ao perfil e Seguidores sao lidos da view salva "Distribuicao Para Seguidores" ' +
    'do Ads Manager (a Graph API nao expoe seguidores por anuncio). Substitua as linhas ' +
    'abaixo pelos numeros da SUA campanha.',
  updatedAt: '2025-01-01',
  metaUrl:
    'https://adsmanager.facebook.com/adsmanager/manage/ads?act=YOUR_AD_ACCOUNT_ID' +
    '&selected_campaign_ids=YOUR_CAMPAIGN_ID',
  // Exemplos — troque pelos dados da sua conta.
  rows: [
    { adName: 'AD - Exemplo 1', status: 'active', today: m(10, 50, 2, 0, 0), lifetime: m(500, 2500, 120, 5, 1) },
    { adName: 'AD - Exemplo 2', status: 'paused', today: Z,                  lifetime: m(150, 700, 30, 1, 0) },
  ],
}
