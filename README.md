# AI Voice Notes Organizer

AI-powered voice notes structuring and knowledge organization system that transforms unstructured audio into structured, searchable knowledge.

## 🎯 Overview

The AI Voice Notes Organizer is a comprehensive system that helps users:
- Convert voice notes to structured text with AI-powered transcription
- Extract key insights and knowledge from audio content
- Organize notes with intelligent categorization and tagging
- Search and retrieve notes using natural language queries
- Build personal knowledge base from voice recordings

## ✨ Key Features

### 🎤 Audio Processing
- Multi-format audio support (MP3, WAV, M4A, etc.)
- AI-powered speech transcription
- Audio quality analysis and enhancement
- Batch processing capabilities

### 🧠 AI Analysis
- Automatic transcription with speaker diarization
- Key points and insights extraction
- Sentiment and emotion analysis
- Topic categorization and keyword extraction
- Knowledge graph generation

### 🗂️ Organization
- Smart categorization and tagging
- Personal knowledge base building
- Search and retrieval system
- Note relationships and linking
- Content summarization

### 📊 Analytics
- Usage statistics and trends
- Knowledge growth tracking
- Audio content analysis reports
- Productivity insights

## 🛠️ Technology Stack

- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite + Prisma ORM
- **AI**: OpenAI GPT-4 for transcription and analysis
- **Audio Processing**: FFmpeg for audio processing
- **Authentication**: JWT-based authentication
- **File Storage**: Local file system with organized structure

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- OpenAI API key

### Installation

1. Clone the repository
```bash
git clone https://github.com/ai-ideas-lab/ai-voice-notes-organizer.git
cd ai-voice-notes-organizer
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your OpenAI API key and other configuration
```

4. Set up database
```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

5. Start the development server
```bash
npm run dev
```

The server will start on `http://localhost:3002`

## 📁 Project Structure

```
ai-voice-notes-organizer/
├── src/
│   ├── routes/           # API routes
│   │   ├── auth.ts       # Authentication routes
│   │   ├── voiceNotes.ts # Voice note management
│   │   ├── analysis.ts   # AI analysis endpoints
│   │   ├── categories.ts # Category management
│   │   ├── tags.ts       # Tag management
│   │   └── analytics.ts  # Analytics endpoints
│   ├── middleware/       # Express middleware
│   │   ├── errorHandler.ts
│   │   └── auth.ts
│   ├── utils/            # Utility functions
│   │   ├── prisma.ts
│   │   ├── logger.ts
│   │   └── audioProcessor.ts
│   └── index.ts          # Main application file
├── prisma/
│   └── schema.prisma    # Database schema
├── uploads/             # Uploaded audio files
├── .env                 # Environment variables
└── package.json         # Project configuration
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Voice Notes
- `POST /api/voice-notes/upload` - Upload audio file
- `GET /api/voice-notes` - List user's voice notes
- `GET /api/voice-notes/:id` - Get specific voice note
- `PUT /api/voice-notes/:id` - Update voice note
- `DELETE /api/voice-notes/:id` - Delete voice note

### Analysis
- `POST /api/voice-notes/:id/analyze` - Trigger AI analysis
- `GET /api/analysis/:noteId` - Get analysis results
- `POST /api/voice-notes/batch-analyze` - Batch analysis

### Organization
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category
- `GET /api/tags` - List tags
- `POST /api/tags` - Create tag

### Analytics
- `GET /api/analytics/overview` - Usage overview
- `GET /api/analytics/knowledge-growth` - Knowledge growth trends
- `GET /api/analytics/insights` - AI insights

## 🧪 Testing

```bash
npm test
```

## 📝 Environment Variables

```env
NODE_ENV=development
PORT=3002
DATABASE_URL="file:./dev.db"
CORS_ORIGIN="http://localhost:3000"
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
JWT_SECRET=your-jwt-secret
OPENAI_API_KEY=your-openai-api-key
```

## 🔐 Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:
```
Authorization: Bearer <token>
```

## 🚀 Deployment

### Production Setup
1. Set up production database (PostgreSQL recommended)
2. Configure environment variables for production
3. Build the application
```bash
npm run build
```
4. Start the production server
```bash
npm start
```

### Docker Support
```bash
docker build -t ai-voice-notes-organizer .
docker run -p 3002:3002 ai-voice-notes-organizer
```

## 📊 API Usage Example

### Upload and Analyze a Voice Note

```bash
# Upload audio file
curl -X POST \
  http://localhost:3002/api/voice-notes/upload \
  -H "Authorization: Bearer <token>" \
  -F "audio=@path/to/audio.mp3"

# Trigger AI analysis
curl -X POST \
  http://localhost:3002/api/voice-notes/analyze \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"noteId": "note-id"}'
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🔄 Updates

This project is part of the AI Ideas Lab initiative. Check for updates and new features regularly!

---

Built with ❤️ by AI Ideas Lab