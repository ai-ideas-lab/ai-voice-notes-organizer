import express from 'express'
import { body, validationResult } from 'express-validator'
import { PrismaClient } from '@prisma/client'
import { authenticateToken } from '../middleware/auth'

const router = express.Router()
const prisma = new PrismaClient()

// Get user's categories
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId

    const categories = await prisma.category.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { notes: true }
        }
      }
    })

    res.json({ categories })

  } catch (error) {
    console.error('Get categories error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create new category
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

    // Check if category already exists for this user
    const existingCategory = await prisma.category.findFirst({
      where: { name, userId }
    })

    if (existingCategory) {
      return res.status(400).json({ error: 'Category already exists' })
    }

    const category = await prisma.category.create({
      data: {
        name,
        color,
        userId
      }
    })

    res.status(201).json({
      message: 'Category created successfully',
      category
    })

  } catch (error) {
    console.error('Create category error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update category
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

    const existingCategory = await prisma.category.findFirst({
      where: { id, userId }
    })

    if (!existingCategory) {
      return res.status(404).json({ error: 'Category not found' })
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(color !== undefined && { color })
      }
    })

    res.json({
      message: 'Category updated successfully',
      category: updatedCategory
    })

  } catch (error) {
    console.error('Update category error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete category
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const userId = (req as any).userId

    const existingCategory = await prisma.category.findFirst({
      where: { id, userId }
    })

    if (!existingCategory) {
      return res.status(404).json({ error: 'Category not found' })
    }

    // Check if category has associated notes
    const notesCount = await prisma.voiceNote.count({
      where: {
        userId,
        categories: {
          some: { id }
        }
      }
    })

    if (notesCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category with associated notes',
        notesCount 
      })
    }

    await prisma.category.delete({
      where: { id }
    })

    res.json({ message: 'Category deleted successfully' })

  } catch (error) {
    console.error('Delete category error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get category with notes
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const userId = (req as any).userId

    const category = await prisma.category.findFirst({
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

    if (!category) {
      return res.status(404).json({ error: 'Category not found' })
    }

    res.json({ category })

  } catch (error) {
    console.error('Get category error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get category statistics
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const userId = (req as any).userId

    const category = await prisma.category.findFirst({
      where: { id, userId }
    })

    if (!category) {
      return res.status(404).json({ error: 'Category not found' })
    }

    const [totalNotes, totalDuration, recentNotes] = await Promise.all([
      prisma.voiceNote.count({
        where: {
          userId,
          categories: {
            some: { id }
          }
        }
      }),
      prisma.voiceNote.aggregate({
        where: {
          userId,
          categories: {
            some: { id }
          }
        },
        _sum: { duration: true }
      }),
      prisma.voiceNote.findMany({
        where: {
          userId,
          categories: {
            some: { id }
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
      categoryId: id,
      categoryName: category.name,
      totalNotes,
      totalDuration: totalDuration._sum.duration || 0,
      recentNotes
    }

    res.json({ stats })

  } catch (error) {
    console.error('Get category stats error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router