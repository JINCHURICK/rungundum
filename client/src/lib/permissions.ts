export const PERM = {
  RAIDS_WRITE:          ['ADMIN', 'VICE_PRESIDENT', 'CAPTAIN'],
  MEMBERS_READ:         ['ADMIN', 'VICE_PRESIDENT', 'CAPTAIN', 'SECRETARY', 'PR', 'TREASURER', 'DISCIPLINA'],
  MEMBERS_WRITE:        ['ADMIN', 'VICE_PRESIDENT', 'CAPTAIN', 'SECRETARY'],
  TREASURY:             ['ADMIN', 'VICE_PRESIDENT', 'TREASURER'],
  QUOTAS:               ['ADMIN', 'VICE_PRESIDENT', 'TREASURER'],
  DISCIPLINARY:         ['ADMIN', 'VICE_PRESIDENT', 'DISCIPLINA'],
  ANNOUNCEMENTS_WRITE:  ['ADMIN', 'VICE_PRESIDENT', 'SECRETARY', 'PR'],
  ANNOUNCEMENTS_READ:   ['ADMIN', 'VICE_PRESIDENT', 'CAPTAIN', 'TREASURER', 'SECRETARY', 'PR', 'DISCIPLINA', 'MEMBER', 'GUEST'],
  SMS:                  ['ADMIN', 'VICE_PRESIDENT', 'TREASURER', 'SECRETARY', 'PR', 'DISCIPLINA'],
  POSITIONS_WRITE:      ['ADMIN', 'VICE_PRESIDENT', 'SECRETARY'],
  POSITIONS_READ:       ['ADMIN', 'VICE_PRESIDENT', 'CAPTAIN', 'TREASURER', 'SECRETARY', 'PR', 'DISCIPLINA', 'MEMBER'],
  STATS:                ['ADMIN', 'VICE_PRESIDENT', 'CAPTAIN', 'TREASURER', 'SECRETARY', 'PR', 'DISCIPLINA'],
  CLUB_CONFIG:          ['ADMIN'],
  SUBSCRIPTIONS:        ['ADMIN', 'TREASURER'],
  ALERTS_CONFIG:        ['ADMIN', 'VICE_PRESIDENT', 'TREASURER'],
} as const

export type PermKey = keyof typeof PERM

export function can(role: string | undefined | null, perm: PermKey): boolean {
  if (!role) return false
  return (PERM[perm] as readonly string[]).includes(role)
}

export const USER_ROLE_LABELS: Record<string, string> = {
  ADMIN:          'Presidente',
  VICE_PRESIDENT: 'Vice-Presidente',
  TREASURER:      'Tesoureiro',
  SECRETARY:      'Secretário',
  PR:             'Relações Públicas',
  DISCIPLINA:     'Disciplina',
  CAPTAIN:        'Capitão',
  MEMBER:         'Membro',
  GUEST:          'Convidado',
}

export function getUserRoleLabel(role: string | undefined | null): string {
  return USER_ROLE_LABELS[role ?? ''] ?? role ?? '—'
}
