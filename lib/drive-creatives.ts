// lib/drive-creatives.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mapeamento de nomes de anúncio → arquivo no Google Drive
// Pasta raiz: https://drive.google.com/drive/folders/1dd-XymutcQl1oKaBGW9mp3BHLEyIPlRc
//
// Para adicionar um novo criativo:
//   1. Abra a pasta no Drive
//   2. Clique com botão direito → "Obter link"
//   3. Copie o ID (parte depois de /d/ e antes de /view)
//   4. Adicione uma entrada em DRIVE_CREATIVES com o nome exato do ad_name
// ─────────────────────────────────────────────────────────────────────────────

export const DRIVE_FOLDER = '1YBwHk_TrjbX_IRoh2Nv9gn92MWjBWBbc' // Lanna

/** Gera link de visualização do arquivo no Drive */
export function driveViewLink(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`
}

/** Gera URL de thumbnail otimizada para exibição no dashboard */
export function driveThumbnail(fileId: string, size = 200): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`
}

// ─── Mapeamento ad_name → Drive file ID ──────────────────────────────────────
// Chave: ad_name exato retornado pela Meta API
// Valor: ID do arquivo no Google Drive

export const DRIVE_CREATIVES: Record<string, string> = {
  // ADE 1 — Você ainda usa ChatGPT? (Foto mesa notebook)
  ADE_AindaUsaChatGPTLogo: '1YaPfSf6LE-_U6cZ-VEoEO-C4gkJy3JQG', // 4x5

  // ADE 2 — Você ainda usa ChatGPT? (Monitor logo Claude)
  ADE_AindaUsaChatGPTDesk: '1udz2lSW8KjJk2C_dkXhHWOYFDOJCveDu', // 4x5

  // ADE 4 — R$97 ÷ 30h = R$3,23 por hora recuperada
  ADE_CustoR323PorHora: '1qHQzJRUhIUPUR5S7earQ95_WamyjXjJr', // 4x5

  // ADE 5 — Mentor não precisa de um time
  ADE_SemTimeComClaude:         '1Tf5ct-lpvhGJsyOjQuy6h2wfFZDB3yRe', // 4x5
  ADE_NaoPrecisaDeMaisHoras_V2: '1Tf5ct-lpvhGJsyOjQuy6h2wfFZDB3yRe', // mesmo criativo

  // ADE 6 — 30h de vantagem acumulada (Relógio derretido)
  ADE_30hVantagemSemanal: '1sscespAM09vwhQ7Z-17Zy_TTr1PZerry', // 4x5

  // ADE 8 — Você usa Claude pra posts, concorrentes rodam a operação
  ADE_VoceUsaClaudePraEscreverPosts: '1nbtD8i-YcFJ7qKzFYrf5r3yWBrfIQGX8', // 4x5

  // ADE 9 — Escalou a mentoria e ficou mais sobrecarregado
  ADE_EscalouMentoriaGrupoSemPreco: '1TqwbrCGGLF8-PvjTkQV4knAo_epsi8fX', // 4x5
  ADE_EscalouMentoriaGrupoComPreco: '1TqwbrCGGLF8-PvjTkQV4knAo_epsi8fX', // mesmo criativo
}

/** Retorna link e thumbnail do Drive para um ad_name, ou null se não mapeado */
export function getDriveCreative(adName: string): { link: string; thumbnail: string } | null {
  const fileId = DRIVE_CREATIVES[adName]
  if (!fileId) return null
  return {
    link: driveViewLink(fileId),
    thumbnail: driveThumbnail(fileId, 200),
  }
}
