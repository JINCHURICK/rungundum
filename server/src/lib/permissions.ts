// Mapa central de permissões por cargo
// Adiciona um cargo a uma lista para lhe dar acesso a essa funcionalidade

export const PERM = {
  // ── Raids ──────────────────────────────────────────────────────────────────
  RAIDS_WRITE:          ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'CAPTAIN'],

  // ── Membros ────────────────────────────────────────────────────────────────
  MEMBERS_READ:         ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'CAPTAIN', 'SECRETARY', 'PR', 'TREASURER', 'DISCIPLINA'],
  MEMBERS_WRITE:        ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'CAPTAIN', 'SECRETARY'],

  // ── Tesouraria ─────────────────────────────────────────────────────────────
  TREASURY:             ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'TREASURER'],

  // ── Quotas ─────────────────────────────────────────────────────────────────
  QUOTAS:               ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'TREASURER'],

  // ── Disciplinar ────────────────────────────────────────────────────────────
  DISCIPLINARY:         ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'DISCIPLINA'],

  // ── Comunicados (escrita) ──────────────────────────────────────────────────
  ANNOUNCEMENTS_WRITE:  ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'SECRETARY', 'PR'],
  // Comunicados (leitura) — todos os membros autenticados vêem
  ANNOUNCEMENTS_READ:   ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'CAPTAIN', 'TREASURER', 'SECRETARY', 'PR', 'DISCIPLINA', 'MEMBER', 'GUEST'],

  // ── SMS ────────────────────────────────────────────────────────────────────
  SMS:                  ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'TREASURER', 'SECRETARY', 'PR', 'DISCIPLINA'],

  // ── Cargos / Órgãos ────────────────────────────────────────────────────────
  POSITIONS_WRITE:      ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'SECRETARY'],
  POSITIONS_READ:       ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'CAPTAIN', 'TREASURER', 'SECRETARY', 'PR', 'DISCIPLINA'],

  // ── Estatísticas ───────────────────────────────────────────────────────────
  STATS:                ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'CAPTAIN', 'TREASURER', 'SECRETARY', 'PR', 'DISCIPLINA'],

  // ── Configurações do clube ─────────────────────────────────────────────────
  CLUB_CONFIG:          ['ADMIN', 'APP_ADMIN'],

  // ── Subscrição / plano ─────────────────────────────────────────────────────
  SUBSCRIPTIONS:        ['ADMIN', 'APP_ADMIN', 'TREASURER'],

  // ── Alertas de quotas ──────────────────────────────────────────────────────
  ALERTS_CONFIG:        ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'TREASURER'],
} as const

export type PermKey = keyof typeof PERM

export function can(role: string | undefined | null, perm: PermKey): boolean {
  if (!role) return false
  return (PERM[perm] as readonly string[]).includes(role)
}
