# WeSupport - Unified Support Dashboard

A unified platform that integrates Luciq (bugs), Intercom (questions), Front (support), and Retool (user management) into a single dashboard.

## 📋 Features

- 🔍 **Unified Search** - Search across all platforms by email or user ID
- 📊 **Real-time Sync** - Automatic data synchronization every 5 minutes
- 🏠 **Centralized Dashboard** - View data from Luciq, Intercom, Front all in one place
- 💾 **Intelligent Caching** - Faster searches with automatic cache management
- 📈 **Integration Status** - Monitor sync status of all connected platforms
- 🔐 **Secure** - OAuth authentication with audit logs

## 🏗️ Project Structure

```
wesupport/
├── frontend/              # Next.js frontend application
│   ├── app/              # App router pages
│   ├── components/       # React components
│   ├── package.json
│   └── tsconfig.json
├── backend/              # Express.js backend API
│   ├── src/
│   │   ├── index.ts      # Main server file
│   │   ├── services/     # Integration services
│   │   ├── routes/       # API endpoints
│   │   └── utils/        # Helper utilities
│   ├── prisma/           # Database schema
│   └── package.json
└── package.json          # Root workspace config
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ & npm/yarn
- PostgreSQL database
- API keys for: Front, Intercom, Luciq, Retool

### 1. Setup Database

```bash
createdb wesupport
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install workspace dependencies
npm install --workspaces
```

### 3. Configure Environment Variables

**Backend** - Create `backend/.env`:
```bash
cp backend/.env.example backend/.env
# Edit with your actual API keys and database URL
```

**Frontend** - Create `frontend/.env.local`:
```bash
cp frontend/.env.local.example frontend/.env.local
```

### 4. Setup Database Schema

```bash
cd backend
npm run prisma:migrate
npm run prisma:generate
cd ..
```

### 5. Run Development Servers

```bash
# From root directory
npm run dev

# Or run individually:
# Terminal 1:
cd backend && npm run dev

# Terminal 2:
cd frontend && npm run dev
```

Frontend: http://localhost:3000  
Backend: http://localhost:3001

## 📚 API Documentation

### Search Endpoints

#### POST `/api/search`
Search across all integrated platforms.

**Request:**
```json
{
  "email": "user@example.com"
  // or
  "userId": "12345"
}
```

**Response:**
```json
{
  "front": [...],
  "intercom": [...],
  "luciq": [...],
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Integration Endpoints

#### GET `/api/integrations/status`
Get current sync status of all integrations.

**Response:**
```json
{
  "front": {
    "status": "success",
    "lastSync": "2024-01-01T12:00:00Z",
    "nextSync": "2024-01-01T12:05:00Z"
  },
  "intercom": {...},
  "luciq": {...}
}
```

#### GET `/api/integrations/sync-logs`
Get recent sync logs.

## 🔌 Integration Setup

### 1. Front API Key
- Go to [Front Dashboard](https://app.frontapp.com)
- Settings → Developer → Create API token
- Add to `backend/.env` as `FRONT_API_KEY`

### 2. Intercom Access Token
- Go to [Intercom Developer Hub](https://developers.intercom.com)
- Create new app
- Generate access token
- Add to `backend/.env` as `INTERCOM_ACCESS_TOKEN`

### 3. Luciq API Key
- Contact Luciq support for API access
- Add to `backend/.env` as `LUCIQ_API_KEY`

### 4. Retool API Key
- Go to Retool Account Settings
- Generate API key
- Add to `backend/.env` as `RETOOL_API_KEY` (future integration)

## 🔄 Data Sync

The platform automatically syncs data every 5 minutes:
- Fetches contacts from Front & Intercom
- Fetches bugs from Luciq
- Caches all results in PostgreSQL
- Logs all sync operations

View sync history at: `/api/integrations/sync-logs`

## 🛠️ Development

### Build Frontend
```bash
cd frontend
npm run build
npm start
```

### Build Backend
```bash
cd backend
npm run build
npm start
```

### Database Schema
Edit `backend/prisma/schema.prisma` then:
```bash
cd backend
npm run prisma:migrate -- --name your_migration_name
```

## 📦 Deployment

### Vercel (Frontend)
```bash
# Connect GitHub repo
vercel link
vercel deploy
```

### Self-hosted (Backend)
```bash
cd backend
npm run build
NODE_ENV=production npm start
```

Set environment variables on your hosting platform.

## 🤝 Future Roadmap

- [ ] Retool user deletion integration
- [ ] Real-time WebSocket updates
- [ ] Advanced filtering & saved searches
- [ ] User deletion workflows
- [ ] Bulk operations
- [ ] Custom dashboards
- [ ] Email notifications

## 📝 License

MIT

## 💬 Support

For issues or questions, reach out to the team.
