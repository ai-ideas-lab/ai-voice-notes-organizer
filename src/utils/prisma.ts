import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Initialize database and create seed data
export const initializeDatabase = async () => {
  try {
    // Test database connection
    await prisma.$connect()
    console.log('✅ Database connected successfully')

    // Run database migrations if needed
    // This would typically be handled by Prisma migrate
    // await prisma.$executeRaw`PRAGMA foreign_keys = ON;`

    // Seed database with initial data
    await seedDatabase()

    console.log('✅ Database initialized successfully')
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    throw error
  }
}

// Database seeding function
const seedDatabase = async () => {
  const existingUsers = await prisma.user.count()
  
  if (existingUsers === 0) {
    console.log('🌱 Seeding initial data...')
    
    // Create default categories
    const defaultCategories = [
      { name: 'Work', color: '#3B82F6' },
      { name: 'Personal', color: '#10B981' },
      { name: 'Learning', color: '#F59E0B' },
      { name: 'Ideas', color: '#8B5CF6' },
      { name: 'Meetings', color: '#EF4444' }
    ]

    await Promise.all(
      defaultCategories.map(category =>
        prisma.category.create({
          data: category
        })
      )
    )

    // Create default tags
    const defaultTags = [
      { name: 'important', color: '#DC2626' },
      { name: 'urgent', color: '#EA580C' },
      { name: 'review', color: '#7C3AED' },
      { name: 'action', color: '#059669' },
      { name: 'follow-up', color: '#0891B2' }
    ]

    await Promise.all(
      defaultTags.map(tag =>
        prisma.tag.create({
          data: tag
        })
      )
    )

    console.log('✅ Initial data seeded successfully')
  }
}

// Health check function
export const checkDatabaseHealth = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'healthy', timestamp: new Date().toISOString() }
  } catch (error) {
    return { 
      status: 'unhealthy', 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
}

// Database cleanup function
export const cleanupDatabase = async () => {
  try {
    // Clean up old processed notes (older than 90 days)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 90)

    const deletedNotes = await prisma.voiceNote.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        status: 'COMPLETED'
      }
    })

    console.log(`🧹 Cleaned up ${deletedNotes.count} old processed notes`)

    // Clean up old analyses
    const deletedAnalyses = await prisma.analysis.deleteMany({
      where: {
        processedAt: { lt: cutoffDate }
      }
    })

    console.log(`🧹 Cleaned up ${deletedAnalyses.count} old analyses`)

    // Clean up old embeddings
    const deletedEmbeddings = await prisma.embedding.deleteMany({
      where: {
        createdAt: { lt: cutoffDate }
      }
    })

    console.log(`🧹 Cleaned up ${deletedEmbeddings.count} old embeddings`)

    return {
      cleanedNotes: deletedNotes.count,
      cleanedAnalyses: deletedAnalyses.count,
      cleanedEmbeddings: deletedEmbeddings.count
    }
  } catch (error) {
    console.error('❌ Database cleanup failed:', error)
    throw error
  }
}

// Database backup function (simplified)
export const createDatabaseBackup = async () => {
  try {
    const backup = {
      timestamp: new Date().toISOString(),
      users: await prisma.user.count(),
      voiceNotes: await prisma.voiceNote.count(),
      categories: await prisma.category.count(),
      tags: await prisma.tag.count(),
      analyses: await prisma.analysis.count(),
      embeddings: await prisma.embedding.count()
    }

    console.log('📊 Database backup created:', backup)
    return backup
  } catch (error) {
    console.error('❌ Database backup failed:', error)
    throw error
  }
}