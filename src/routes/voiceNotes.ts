import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { body, validationResult } from 'express-validator'
import { PrismaClient } from '@prisma/client'
import { authenticateToken } from '../middleware/auth'

const router = express.Router()
const prisma = new PrismaClient()

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'voice-notes')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp3|wav|m4a|ogg|flac|aac/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)

    if (mimetype && extname) {
      return cb(null, true)
    } else {
      cb(new Error('Only audio files are allowed!'))
    }
  }
})

// Upload voice note
router.post('/upload', authenticateToken, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' })
    }

    const { title, description } = req.body
    const userId = (req as any).userId

    // Create voice note record
    const voiceNote = await prisma.voiceNote.create({
      data: {
        title: title || req.file.originalname,
        description,
        originalUrl: `/uploads/voice-notes/${req.file.filename}`,
        audioPath: req.file.path,
        fileSize: req.file.size,
        duration: 0, // Will be updated after audio processing
        language: null,
        transcription: null,
        summary: null,
        keyPoints: null,
        tags: [],
        sentiment: null,
        emotions: null,
        category: null,
        status: 'PROCESSING',
        userId
      }
    })

    // TODO: Add background job for audio processing
    // For now, return the created note
    res.status(201).json({
      message: 'Voice note uploaded successfully',
      voiceNote: {
        id: voiceNote.id,
        title: voiceNote.title,
        description: voiceNote.description,
        status: voiceNote.status,
        createdAt: voiceNote.createdAt
      }
    })

  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get user's voice notes
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId
    const { page = 1, limit = 10, status, category } = req.query

    const skip = (Number(page) - 1) * Number(limit)
    
    const where: any = { userId }
    if (status) where.status = status
    if (category) where.category = category

    const [voiceNotes, total] = await Promise.all([
      prisma.voiceNote.findMany({
        where,
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
      prisma.voiceNote.count({ where })
    ])

    res.json({
      voiceNotes,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    })

  } catch (error) {
    console.error('Get voice notes error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get specific voice note
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const userId = (req as any).userId

    const voiceNote = await prisma.voiceNote.findFirst({
      where: {
        id,
        userId
      },
      include: {
        categories: true,
        tags: true,
        analyses: {
          orderBy: { processedAt: 'desc' }
        },
        embeddings: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!voiceNote) {
      return res.status(404).json({ error: 'Voice note not found' })
    }

    res.json({ voiceNote })

  } catch (error) {
    console.error('Get voice note error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update voice note
router.put('/:id', authenticateToken, [
  body('title').optional().isLength({ min: 1 }).trim(),
  body('description').optional().trim(),
  body('category').optional().trim(),
  body('tags').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { id } = req.params
    const userId = (req as any).userId
    const { title, description, category, tags } = req.body

    const existingNote = await prisma.voiceNote.findFirst({
      where: { id, userId }
    })

    if (!existingNote) {
      return res.status(404).json({ error: 'Voice note not found' })
    }

    const updatedNote = await prisma.voiceNote.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(tags !== undefined && { tags: tags as string[] })
      },
      include: {
        categories: true,
        tags: true,
        analyses: true
      }
    })

    res.json({
      message: 'Voice note updated successfully',
      voiceNote: updatedNote
    })

  } catch (error) {
    console.error('Update voice note error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete voice note
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const userId = (req as any).userId

    const existingNote = await prisma.voiceNote.findFirst({
      where: { id, userId }
    })

    if (!existingNote) {
      return res.status(404).json({ error: 'Voice note not found' })
    }

    // Delete file from filesystem
    if (fs.existsSync(existingNote.audioPath)) {
      fs.unlinkSync(existingNote.audioPath)
    }

    await prisma.voiceNote.delete({
      where: { id }
    })

    res.json({ message: 'Voice note deleted successfully' })

  } catch (error) {
    console.error('Delete voice note error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Batch analyze voice notes
router.post('/batch-analyze', authenticateToken, async (req, res) => {
  try {
    const { noteIds } = req.body
    const userId = (req as any).userId

    if (!Array.isArray(noteIds) || noteIds.length === 0) {
      return res.status(400).json({ error: 'Note IDs array is required' })
    }

    // Verify user owns all notes
    const notes = await prisma.voiceNote.findMany({
      where: {
        id: { in: noteIds },
        userId
      }
    })

    if (notes.length !== noteIds.length) {
      return res.status(400).json({ error: 'Some notes do not exist or do not belong to you' })
    }

    // TODO: Implement batch processing job
    // For now, return success response
    res.json({
      message: 'Batch analysis job started',
      noteIds,
      processed: 0,
      total: noteIds.length
    })

  } catch (error) {
    console.error('Batch analyze error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router