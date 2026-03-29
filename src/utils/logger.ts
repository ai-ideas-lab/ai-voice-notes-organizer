import winston from 'winston'
import path from 'path'

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`
    }
    return msg
  })
)

// JSON format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: fileFormat,
  defaultMeta: { service: 'ai-voice-notes-organizer' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    }),
    
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Write error logs to error.log
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ]
})

// Handle uncaught exceptions
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'exceptions.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    tailable: true
  })
)

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

// Create logs directory if it doesn't exist
import fs from 'fs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const logsDir = path.join(__dirname, '../logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

// Helper functions for common logging scenarios
export const logUtils = {
  // Log API requests
  apiRequest: (method: string, url: string, userId?: string, duration?: number) => {
    logger.info('API Request', {
      method,
      url,
      userId,
      duration: duration ? `${duration}ms` : undefined
    })
  },

  // Log database operations
  databaseOperation: (operation: string, table: string, id?: string, success: boolean = true) => {
    logger.info('Database Operation', {
      operation,
      table,
      id,
      success
    })
  },

  // Log AI operations
  aiOperation: (operation: string, model: string, inputSize: number, success: boolean = true) => {
    logger.info('AI Operation', {
      operation,
      model,
      inputSize,
      success
    })
  },

  // Log file operations
  fileOperation: (operation: string, filename: string, size?: number) => {
    logger.info('File Operation', {
      operation,
      filename,
      size: size ? `${size} bytes` : undefined
    })
  },

  // Log user actions
  userAction: (action: string, userId: string, details?: any) => {
    logger.info('User Action', {
      action,
      userId,
      ...details
    })
  },

  // Log errors with context
  error: (error: Error, context?: any) => {
    logger.error(error.message, {
      stack: error.stack,
      ...context
    })
  }
}