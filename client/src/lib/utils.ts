import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: 'long', year: 'numeric', ...opts }).format(new Date(date))
}

export function formatShortDate(date: string | Date) {
  return new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date))
}

export function getRaidStatusLabel(status: string) {
  return { DRAFT: 'Rascunho', CONFIRMED: 'Confirmado', IN_PROGRESS: 'Em Curso', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' }[status] ?? status
}

export function getRaidStatusColor(status: string) {
  return {
    DRAFT: 'bg-gray-100 text-gray-700',
    CONFIRMED: 'bg-blue-100 text-blue-700',
    IN_PROGRESS: 'bg-green-100 text-green-700',
    COMPLETED: 'bg-purple-100 text-purple-700',
    CANCELLED: 'bg-red-100 text-red-700',
  }[status] ?? 'bg-gray-100 text-gray-700'
}

export function getMemberStatusLabel(status: string) {
  return { ACTIVE: 'Activo', INACTIVE: 'Inactivo', SUSPENDED: 'Suspenso', GUEST: 'Convidado' }[status] ?? status
}

// Papel no raid (ParticipantRole)
export function getRoleLabel(role: string) {
  return { LEADER: 'Líder', TAIL: 'Cauda', MEMBER: 'Membro', MECHANIC: 'Mecânico', SUPPORT: 'Apoio' }[role] ?? role
}

// Cargo do utilizador no clube (UserRole)
export function getUserRoleLabel(role: string | undefined | null) {
  return {
    ADMIN:          'Presidente',
    APP_ADMIN:      'Administrador de App',
    VICE_PRESIDENT: 'Vice-Presidente',
    TREASURER:      'Tesoureiro',
    SECRETARY:      'Secretário',
    PR:             'Relações Públicas',
    DISCIPLINA:     'Disciplina',
    CAPTAIN:        'Capitão',
    MEMBER:         'Membro',
    GUEST:          'Convidado',
  }[role ?? ''] ?? role ?? '—'
}

export function getDifficultyLabel(diff: string) {
  return { EASY: 'Fácil', MEDIUM: 'Médio', HARD: 'Difícil' }[diff] ?? diff
}

export function getVehicleTypeLabel(type: string) {
  return { TRAIL: 'Trail', ROAD: 'Estradeira', CUSTOM: 'Custom', SCOOTER: 'Scooter', SUPPORT: 'Apoio', OTHER: 'Outro' }[type] ?? type
}

// Install clsx: npm i clsx
