import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticateToken } from '../middleware/auth'

const router = express.Router()
const prisma = new PrismaClient()

// Get user's analytics overview
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId

    const [
      totalNotes,
      totalDuration,
      completedNotes,
      processingNotes,
      failedNotes,
      totalCategories,
      totalTags,
      recentActivity
    ] = await Promise.all([
      prisma.voiceNote.count({ where: { userId } }),
      prisma.voiceNote.aggregate({
        where: { userId },
        _sum: { duration: true }
      }),
      prisma.voiceNote.count({ 
        where: { 
          userId,
          status: 'COMPLETED' 
        } 
      }),
      prisma.voiceNote.count({ 
        where: { 
          userId,
          status: 'PROCESSING' 
        } 
      }),
      prisma.voiceNote.count({ 
        where: { 
          userId,
          status: 'FAILED' 
        } 
      }),
      prisma.category.count({ where: { userId } }),
      prisma.tag.count({ where: { userId } }),
      prisma.voiceNote.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          createdAt: true,
          status: true,
          duration: true
        }
      })
    ])

    const overview = {
      totalNotes,
      totalDuration: totalDuration._sum.duration || 0,
      completedNotes,
      processingNotes,
      failedNotes,
      totalCategories,
      totalTags,
      completionRate: totalNotes > 0 ? (completedNotes / totalNotes) * 100 : 0,
      recentActivity
    }

    res.json({ overview })

  } catch (error) {
    console.error('Get analytics overview error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get knowledge growth trends
router.get('/knowledge-growth', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId
    const { days = 30 } = req.query

    const daysNumber = parseInt(days as string)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysNumber)

    // Get notes created in the specified period
    const notes = await prisma.voiceNote.findMany({
      where: {
        userId,
        createdAt: { gte: startDate }
      },
      orderBy: { createdAt: 'asc' }
    })

    // Group notes by date
    const dailyStats = notes.reduce((acc, note) => {
      const date = note.createdAt.toISOString().split('T')[0]
      if (!acc[date]) {
        acc[date] = {
          date,
          notes: 0,
          duration: 0,
          completed: 0,
          failed: 0
        }
      }
      acc[date].notes++
      acc[date].duration += note.duration || 0
      if (note.status === 'COMPLETED') acc[date].completed++
      if (note.status === 'FAILED') acc[date].failed++
      return acc
    }, {} as any)

    // Convert to array and sort by date
    const growthData = Object.values(dailyStats).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    const knowledgeGrowth = {
      period: `${daysNumber} days`,
      totalNotes: notes.length,
      totalDuration: notes.reduce((sum, note) => sum + (note.duration || 0), 0),
      averageNotesPerDay: notes.length / daysNumber,
      dailyTrends: growthData,
      cumulativeGrowth: growthData.map((day: any, index: number, array: any[]) => ({
        date: day.date,
        cumulativeNotes: array.slice(0, index + 1).reduce((sum, d) => sum + d.notes, 0),
        cumulativeDuration: array.slice(0, index + 1).reduce((sum, d) => sum + d.duration, 0)
      }))
    }

    res.json({ knowledgeGrowth })

  } catch (error) {
    console.error('Get knowledge growth error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get category distribution
router.get('/categories-distribution', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId

    const categories = await prisma.category.findMany({
      where: { userId },
      include: {
        _count: {
          select: { notes: true }
        },
        notes: {
          where: { userId },
          select: {
            id: true,
            duration: true,
            createdAt: true
          }
        }
      }
    })

    const distribution = categories.map(category => ({
      id: category.id,
      name: category.name,
      color: category.color,
      noteCount: category._count.notes,
      totalDuration: category.notes.reduce((sum, note) => sum + (note.duration || 0), 0),
      percentage: 0 // Will be calculated
    }))

    const totalNotes = distribution.reduce((sum, cat) => sum + cat.noteCount, 0)

    const distributionWithPercentages = distribution.map(cat => ({
      ...cat,
      percentage: totalNotes > 0 ? (cat.noteCount / totalNotes) * 100 : 0
    }))

    res.json({ 
      categoryDistribution: distributionWithPercentages,
      totalNotes
    })

  } catch (error) {
    console.error('Get category distribution error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get tags cloud data
router.get('/tags-cloud', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId

    const tags = await prisma.tag.findMany({
      where: { userId },
      include: {
        _count: {
          select: { notes: true }
        }
      }
    })

    const tagCloud = tags.map(tag => ({
      text: tag.name,
      value: tag._count.notes,
      color: tag.color
    })).sort((a, b) => b.value - a.value)

    res.json({ tagCloud })

  } catch (error) {
    console.error('Get tags cloud error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get analysis insights
router.get('/insights', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId

    const [totalNotes, totalDuration, averageDuration, categoryStats, sentimentStats, recentInsights] = await Promise.all([
      prisma.voiceNote.count({ where: { userId } }),
      prisma.voiceNote.aggregate({
        where: { userId },
        _sum: { duration: true }
      }),
      prisma.voiceNote.aggregate({
        where: { userId, duration: { gt: 0 } },
        _avg: { duration: true }
      }),
      prisma.voiceNote.groupBy({
        by: ['category'],
        where: { 
          userId,
          category: { not: null }
        },
        _count: { id: true },
        _sum: { duration: true },
        orderBy: { _count: { id: 'desc' } }
      }),
      prisma.voiceNote.groupBy({
        by: ['sentiment'],
        where: { 
          userId,
          sentiment: { not: null }
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } }
      }),
      prisma.voiceNote.findMany({
        where: { userId, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          summary: true,
          createdAt: true,
          sentiment: true,
          categories: {
            select: { name: true }
          }
        }
      })
    ])

    const insights = {
      summary: {
        totalNotes,
        totalDuration: totalDuration._sum.duration || 0,
        averageDuration: averageDuration._avg.duration || 0
      },
      topCategories: categoryStats.slice(0, 5).map(cat => ({
        name: cat.category,
        noteCount: cat._count.id,
        totalDuration: cat._sum.duration || 0
      })),
      sentimentDistribution: sentimentStats.map(sentiment => ({
        sentiment: sentiment.sentiment,
        count: sentiment._count.id,
        percentage: totalNotes > 0 ? (sentiment._count.id / totalNotes) * 100 : 0
      })),
      recentInsights: recentInsights.map(note => ({
        id: note.id,
        title: note.title,
        summary: note.summary,
        sentiment: note.sentiment,
        categories: note.categories.map(cat => cat.name),
        createdAt: note.createdAt
      }))
    }

    res.json({ insights })

  } catch (error) {
    console.error('Get insights error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get productivity trends
router.get('/productivity', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId
    const { days = 7 } = req.query

    const daysNumber = parseInt(days as string)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysNumber)

    const notes = await prisma.voiceNote.findMany({
      where: {
        userId,
        createdAt: { gte: startDate }
      },
      orderBy: { createdAt: 'asc' }
    })

    // Group by day and hour
    const hourlyStats = notes.reduce((acc, note) => {
      const date = note.createdAt.toISOString().split('T')[0]
      const hour = note.createdAt.getHours()
      
      if (!acc[date]) {
        acc[date] = Array(24).fill(0)
      }
      acc[date][hour]++
      return acc
    }, {} as any)

    const productivityTrends = {
      period: `${daysNumber} days`,
      totalNotes: notes.length,
      totalDuration: notes.reduce((sum, note) => sum + (note.duration || 0), 0),
      hourlyActivity: Object.entries(hourlyStats).map(([date, hours]) => ({
        date,
        activity: hours as number[]
      })),
      peakHours: Object.entries(hourlyStats)
        .flatMap(([date, hours]) => 
          (hours as number[]).map((count, hour) => ({ date, hour, count }))
        )
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    }

    res.json({ productivityTrends })

  } catch (error) {
    console.error('Get productivity trends error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router