import express from 'express'
import { body, validationResult } from 'express-validator'
import { PrismaClient } from '@prisma/client'
import { authenticateToken } from '../middleware/auth'

const router = express.Router()
const prisma = new PrismaClient()

// Get user's tags
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId

    const tags = await prisma.tag.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { notes: true }
        }
      }
    })

    res.json({ tags })

  } catch (error) {
    console.error('Get tags error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create new tag
router.post('/', authenticateToken, [
  body('name').isLength({ min: 1 }).trim(),
  body('color').optional().isHexColor()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { name, color } = req.body
    const userId = (req as any).userId

    // Check if tag already exists for this user
    const existingTag = await prisma.tag.findFirst({
      where: { name, userId }
    })

    if (existingTag) {
      return res.status(400).json({ error: 'Tag already exists' })
    }

    const tag = await prisma.tag.create({
      data: {
        name,
        color,
        userId
      }
    })

    res.status(201).json({
      message: 'Tag created successfully',
      tag
    })

  } catch (error) {
    console.error('Create tag error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update tag
router.put('/:id', authenticateToken, [
  body('name').optional().isLength({ min: 1 }).trim(),
  body('color').optional().isHexColor()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { id } = req.params
    const { name, color } = req.body
    const userId = (req as any).userId

    const existingTag = await prisma.tag.findFirst({
      where: { id, userId }
    })

    if (!existingTag) {
      return res.status(404).json({ error: 'Tag not found' })
    }

    const updatedTag = await prisma.tag.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(color !== undefined && { color })
      }
    })

    res.json({
      message: 'Tag updated successfully',
      tag: updatedTag
    })

  } catch (error) {
    console.error('Update tag error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete tag
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const userId = (req as any).userId

    const existingTag = await prisma.tag.findFirst({
      where: { id, userId }
    })

    if (!existingTag) {
      return res.status(404).json({ error: 'Tag not found' })
    }

    // Check if tag has associated notes
    const notesCount = await prisma.voiceNote.count({
      where: {
        userId,
        tags: {
          has: existingTag.name
        }
      }
    })

    if (notesCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete tag with associated notes',
        notesCount 
      })
    }

    await prisma.tag.delete({
      where: { id }
    })

    res.json({ message: 'Tag deleted successfully' })

  } catch (error) {
    console.error('Delete tag error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get tag with notes
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const userId = (req as any).userId

    const tag = await prisma.tag.findFirst({
      where: { id, userId },
      include: {
        notes: {
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        _count: {
          select: { notes: true }
        }
      }
    })

    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' })
    }

    res.json({ tag })

  } catch (error) {
    console.error('Get tag error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get tag statistics
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const userId = (req as any).userId

    const tag = await prisma.tag.findFirst({
      where: { id, userId }
    })

    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' })
    }

    const [totalNotes, totalDuration, recentNotes] = await Promise.all([
      prisma.voiceNote.count({
        where: {
          userId,
          tags: {
            has: tag.name
          }
        }
      }),
      prisma.voiceNote.aggregate({
        where: {
          userId,
          tags: {
            has: tag.name
          }
        },
        _sum: { duration: true }
      }),
      prisma.voiceNote.findMany({
        where: {
          userId,
          tags: {
            has: tag.name
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          createdAt: true,
          duration: true
        }
      })
    ])

    const stats = {
      tagId: id,
      tagName: tag.name,
      totalNotes,
      totalDuration: totalDuration._sum.duration || 0,
      recentNotes
    }

    res.json({ stats })

  } catch (error) {
    console.error('Get tag stats error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Search notes by tag
router.get('/:id/notes', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const userId = (req as any).userId
    const { page = 1, limit = 10 } = req.query

    const tag = await prisma.tag.findFirst({
      where: { id, userId }
    })

    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' })
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [notes, total] = await Promise.all([
      prisma.voiceNote.findMany({
        where: {
          userId,
          tags: {
            has: tag.name
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          categories: true,
          tags: true,
          analyses: {
            orderBy: { processedAt: 'desc' }
          }
        }
      }),
      prisma.voiceNote.count({
        where: {
          userId,
          tags: {
            has: tag.name
          }
        }
      })
    ])

    res.json({
      notes,
      tag: {
        id: tag.id,
        name: tag.name,
        color: tag.color
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    })

  } catch (error) {
    console.error('Search notes by tag error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router