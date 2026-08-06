export const PERM = {
  RAIDS_WRITE:          ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'CAPTAIN'],
  MEMBERS_READ:         ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'CAPTAIN', 'SECRETARY', 'PR', 'TREASURER', 'DISCIPLINA'],
  MEMBERS_WRITE:        ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'CAPTAIN', 'SECRETARY'],
  TREASURY:             ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'TREASURER'],
  QUOTAS:               ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'TREASURER'],
  DISCIPLINARY:         ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'DISCIPLINA'],
  ANNOUNCEMENTS_WRITE:  ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'SECRETARY', 'PR'],
  ANNOUNCEMENTS_READ:   ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'CAPTAIN', 'TREASURER', 'SECRETARY', 'PR', 'DISCIPLINA', 'MEMBER', 'GUEST'],
  SMS:                  ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'TREASURER', 'SECRETARY', 'PR', 'DISCIPLINA'],
  POSITIONS_WRITE:      ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'SECRETARY'],
  POSITIONS_READ:       ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'CAPTAIN', 'TREASURER', 'SECRETARY', 'PR', 'DISCIPLINA'],
  STATS:                ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'CAPTAIN', 'TREASURER', 'SECRETARY', 'PR', 'DISCIPLINA'],
  CLUB_CONFIG:          ['ADMIN', 'APP_ADMIN'],
  SUBSCRIPTIONS:        ['ADMIN', 'APP_ADMIN', 'TREASURER'],
  ALERTS_CONFIG:        ['ADMIN', 'APP_ADMIN', 'VICE_PRESIDENT', 'TREASURER'],
} as const

export type PermKey = keyof typeof PERM

export function can(role: string | undefined | null, perm: PermKey): boolean {
  if (!role) return false
  return (PERM[perm] as readonly string[]).includes(role)
}

export const USER_ROLE_LABELS: Record<string, string> = {
  ADMIN:          'Presidente',
  APP_ADMIN:      'Adm. App',
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
