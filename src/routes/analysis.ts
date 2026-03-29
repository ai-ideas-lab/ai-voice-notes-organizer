import express from 'express'
import { body, validationResult } from 'express-validator'
import { OpenAI } from 'openai'
import { PrismaClient } from '@prisma/client'
import { authenticateToken } from '../middleware/auth'

const router = express.Router()
const prisma = new PrismaClient()

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Analyze voice note
router.post('/voice-notes/:id/analyze', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const userId = (req as any).userId
    const { analysisTypes = ['TRANSCRIPTION', 'SUMMARY', 'KEY_POINTS'] } = req.body

    // Verify user owns the note
    const voiceNote = await prisma.voiceNote.findFirst({
      where: { id, userId }
    })

    if (!voiceNote) {
      return res.status(404).json({ error: 'Voice note not found' })
    }

    if (voiceNote.status !== 'PROCESSING' && voiceNote.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Note is not ready for analysis' })
    }

    // Update status to processing
    await prisma.voiceNote.update({
      where: { id },
      data: { status: 'PROCESSING' }
    })

    try {
      // Perform AI analysis
      const results = await performAIAnalysis(voiceNote, analysisTypes)

      // Update voice note with results
      const updateData: any = {
        status: 'COMPLETED'
      }

      if (results.transcription) {
        updateData.transcription = results.transcription
        updateData.language = results.language
      }

      if (results.summary) {
        updateData.summary = results.summary
      }

      if (results.keyPoints) {
        updateData.keyPoints = results.keyPoints
      }

      if (results.sentiment) {
        updateData.sentiment = results.sentiment
      }

      if (results.emotions) {
        updateData.emotions = results.emotions
      }

      if (results.keywords) {
        updateData.tags = results.keywords
      }

      const updatedNote = await prisma.voiceNote.update({
        where: { id },
        data: updateData,
        include: {
          categories: true,
          tags: true,
          analyses: {
            orderBy: { processedAt: 'desc' }
          }
        }
      })

      // Save analysis results
      for (const analysis of results.analyses) {
        await prisma.analysis.create({
          data: {
            type: analysis.type,
            result: analysis.result,
            confidence: analysis.confidence,
            noteId: id
          }
        })
      }

      res.json({
        message: 'Analysis completed successfully',
        voiceNote: updatedNote,
        results
      })

    } catch (analysisError) {
      console.error('AI analysis error:', analysisError)
      
      // Update status to failed
      await prisma.voiceNote.update({
        where: { id },
        data: { status: 'FAILED' }
      })

      res.status(500).json({ 
        error: 'Analysis failed',
        details: analysisError.message 
      })
    }

  } catch (error) {
    console.error('Analyze voice note error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get analysis results for a note
router.get('/voice-notes/:id/analyses', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const userId = (req as any).userId

    const voiceNote = await prisma.voiceNote.findFirst({
      where: { id, userId },
      include: {
        analyses: {
          orderBy: { processedAt: 'desc' }
        }
      }
    })

    if (!voiceNote) {
      return res.status(404).json({ error: 'Voice note not found' })
    }

    res.json({
      voiceNote: {
        id: voiceNote.id,
        title: voiceNote.title,
        status: voiceNote.status,
        analyses: voiceNote.analyses
      }
    })

  } catch (error) {
    console.error('Get analyses error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Perform AI analysis on voice note
async function performAIAnalysis(voiceNote: any, analysisTypes: string[]) {
  const results: any = {
    transcription: null,
    summary: null,
    keyPoints: null,
    sentiment: null,
    emotions: null,
    keywords: [],
    language: null,
    analyses: []
  }

  // For now, simulate analysis since we don't have actual audio processing
  // In a real implementation, you would:
  // 1. Convert audio to text using speech recognition
  // 2. Use OpenAI for text analysis
  
  const mockContent = `
    This is a sample transcription of the voice note titled "${voiceNote.title}".
    The content discusses various topics and contains important insights that need to be extracted.
    The speaker talks about productivity, AI tools, and personal development.
  `

  for (const analysisType of analysisTypes) {
    try {
      let analysisResult: any = null
      let confidence: number | null = null

      switch (analysisType) {
        case 'TRANSCRIPTION':
          // In real implementation: use speech-to-text service
          analysisResult = mockContent
          confidence = 0.95
          results.transcription = mockContent
          results.language = 'en'
          break

        case 'SUMMARY':
          // Use OpenAI to generate summary
          const summaryResponse = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content: 'You are a professional summarizer. Create a concise summary of the provided text.'
              },
              {
                role: 'user',
                content: `Summarize this text in 2-3 sentences:\n\n${mockContent}`
              }
            ],
            max_tokens: 200
          })
          analysisResult = summaryResponse.choices[0]?.message?.content || 'No summary generated'
          confidence = 0.9
          results.summary = analysisResult
          break

        case 'KEY_POINTS':
          // Use OpenAI to extract key points
          const keyPointsResponse = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content: 'You are an expert at extracting key points from text. Return a numbered list of the most important points.'
              },
              {
                role: 'user',
                content: `Extract the key points from this text:\n\n${mockContent}`
              }
            ],
            max_tokens: 300
          })
          analysisResult = keyPointsResponse.choices[0]?.message?.content || 'No key points extracted'
          confidence = 0.85
          results.keyPoints = analysisResult
          break

        case 'SENTIMENT':
          // Use OpenAI for sentiment analysis
          const sentimentResponse = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content: 'You are a sentiment analysis expert. Analyze the sentiment of the text and return: positive, negative, or neutral.'
              },
              {
                role: 'user',
                content: `Analyze the sentiment of this text:\n\n${mockContent}`
              }
            ],
            max_tokens: 50
          })
          analysisResult = sentimentResponse.choices[0]?.message?.content || 'neutral'
          confidence = 0.8
          results.sentiment = analysisResult
          break

        case 'EMOTION':
          // Use OpenAI for emotion analysis
          const emotionResponse = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content: 'You are an emotion analysis expert. Identify the primary emotions in the text from this list: happy, sad, angry, anxious, excited, calm, frustrated, confident.'
              },
              {
                role: 'user',
                content: `Identify the emotions in this text:\n\n${mockContent}`
              }
            ],
            max_tokens: 100
          })
          analysisResult = emotionResponse.choices[0]?.message?.content || 'neutral'
          confidence = 0.75
          results.emotions = analysisResult
          break

        case 'KEYWORD_EXTRACTION':
          // Use OpenAI for keyword extraction
          const keywordResponse = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content: 'You are an expert at extracting relevant keywords. Return a comma-separated list of important keywords.'
              },
              {
                role: 'user',
                content: `Extract keywords from this text:\n\n${mockContent}`
              }
            ],
            max_tokens: 100
          })
          const keywords = keywordResponse.choices[0]?.message?.content?.split(',').map(k => k.trim()) || []
          results.keywords = keywords
          confidence = 0.8
          break

        default:
          console.warn(`Unknown analysis type: ${analysisType}`)
      }

      if (analysisResult) {
        results.analyses.push({
          type: analysisType,
          result: analysisResult,
          confidence
        })
      }

    } catch (error) {
      console.error(`Error during ${analysisType} analysis:`, error)
      results.analyses.push({
        type: analysisType,
        result: `Analysis failed: ${error.message}`,
        confidence: 0
      })
    }
  }

  return results
}

// Get available analysis types
router.get('/types', authenticateToken, (req, res) => {
  const analysisTypes = [
    { type: 'TRANSCRIPTION', description: 'Convert speech to text' },
    { type: 'SUMMARY', description: 'Generate text summary' },
    { type: 'KEY_POINTS', description: 'Extract key insights' },
    { type: 'SENTIMENT', description: 'Analyze sentiment' },
    { type: 'EMOTION', description: 'Identify emotions' },
    { type: 'KEYWORD_EXTRACTION', description: 'Extract keywords' },
    { type: 'TOPIC', description: 'Identify main topics' },
    { type: 'KNOWLEDGE_EXTRACTION', description: 'Extract knowledge entities' }
  ]

  res.json({ analysisTypes })
})

export default router