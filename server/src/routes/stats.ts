import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// GET /api/stats
router.get('/', async (req: AuthRequest, res: Response) => {
  const clubId = req.user!.clubId

  const [raids, members, participants] = await Promise.all([
    prisma.raid.findMany({
      where: { clubId },
      select: {
        id: true, status: true, date: true, estimatedKm: true,
        _count: { select: { participants: true } },
      },
    }),
    prisma.member.findMany({
      where: { clubId },
      select: { id: true, status: true, fullName: true, nickname: true, photoUrl: true },
    }),
    prisma.participant.findMany({
      where: { raid: { clubId } },
      select: {
        memberId: true, status: true,
        member: { select: { fullName: true, nickname: true } },
      },
    }),
  ])

  const totalRaids = raids.length
  const completedRaids = raids.filter((r) => r.status === 'COMPLETED').length
  const upcomingRaids = raids.filter((r) => ['CONFIRMED', 'IN_PROGRESS'].includes(r.status)).length
  const totalKm = raids
    .filter((r) => r.status === 'COMPLETED' && r.estimatedKm)
    .reduce((sum, r) => sum + (r.estimatedKm ?? 0), 0)

  const activeMembers = members.filter((m) => m.status === 'ACTIVE').length

  // Raids by month (last 12 months)
  const now = new Date()
  const months: { month: string; count: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = d.toLocaleDateString('pt-AO', { month: 'short', year: '2-digit' })
    const count = raids.filter((r) => {
      const rd = new Date(r.date)
      return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth()
    }).length
    months.push({ month: label, count })
  }

  // Top participants (confirmed participations)
  const memberCounts: Record<string, { name: string; count: number }> = {}
  for (const p of participants) {
    if (p.status === 'CONFIRMED') {
      if (!memberCounts[p.memberId]) {
        memberCounts[p.memberId] = {
          name: p.member.nickname ?? p.member.fullName,
          count: 0,
        }
      }
      memberCounts[p.memberId].count++
    }
  }
  const topParticipants = Object.values(memberCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return res.json({
    totalRaids,
    completedRaids,
    upcomingRaids,
    totalKm: Math.round(totalKm),
    totalMembers: members.length,
    activeMembers,
    raidsByMonth: months,
    topParticipants,
  })
})

export default router
