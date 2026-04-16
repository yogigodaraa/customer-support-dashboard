# WeSupport - Complete File Inventory

## 📋 Documentation Files

### Core Documentation
- **README.md** - Complete project documentation with setup, deployment, and API docs
- **BUILD_SUMMARY.md** - Detailed summary of what was built and architecture overview
- **API_SETUP_GUIDE.md** - Step-by-step guide for obtaining and configuring API keys
- **USER_GUIDE.md** - End-user guide for using the WeSupport dashboard

### Configuration Files
- **setup.sh** - Automated setup script
- **.gitignore** - Git ignore patterns
- **FILE_STRUCTURE.md** - This file

---

## 🎯 Root Level Files

```
/Users/intern/Downloads/wemoney/wesupport/
├── package.json                # Workspace root configuration
├── README.md                   # Main documentation
├── BUILD_SUMMARY.md            # Build overview
├── API_SETUP_GUIDE.md          # API setup instructions
├── USER_GUIDE.md               # User documentation
├── FILE_STRUCTURE.md           # This file
├── setup.sh                    # Setup automation script
└── .gitignore
```

---

## 🔧 Backend Files

```
backend/
├── package.json                # Dependencies & scripts
├── tsconfig.json               # TypeScript configuration
├── .env.example                # Environment variables template
│
├── src/
│   ├── index.ts               # Main Express server setup
│   │
│   ├── services/
│   │   ├── frontService.ts    # Front API client
│   │   ├── intercomService.ts # Intercom API client
│   │   ├── luciqService.ts    # Luciq API client
│   │   ├── unifiedSearchService.ts  # Consolidated search logic
│   │   └── syncService.ts     # Background sync scheduler
│   │
│   ├── routes/
│   │   ├── search.ts          # Search endpoints
│   │   └── integrations.ts    # Integration status endpoints
│   │
│   └── utils/
│       ├── logger.ts          # Winston logger setup
│       └── prisma.ts          # Prisma client singleton
│
└── prisma/
    └── schema.prisma          # Database schema definition
```

### Backend Features
- Express.js HTTP server on port 3001
- PostgreSQL database with Prisma ORM
- API integrations for Front, Intercom, Luciq
- Unified search across all platforms
- Automatic 5-minute sync scheduler
- Request logging and audit trails
- Error handling and graceful shutdown

---

## 🎨 Frontend Files

```
frontend/
├── package.json               # Dependencies & scripts
├── tsconfig.json              # TypeScript configuration
├── next.config.ts             # Next.js configuration
├── tailwind.config.js         # Tailwind CSS config
├── postcss.config.js          # PostCSS configuration
├── .eslintrc.json             # ESLint configuration
├── .env.local.example         # Environment variables template
│
├── app/
│   ├── layout.tsx            # Root layout component
│   ├── page.tsx              # Home/dashboard page
│   └── globals.css           # Global Tailwind styles
│
└── components/
    ├── SearchBar.tsx         # Email/ID search input
    ├── SearchResults.tsx     # Multi-source results display
    └── IntegrationStatus.tsx # Integration health widget
```

### Frontend Features
- Next.js 14 with App Router
- React 18 with TypeScript
- Tailwind CSS for styling
- Email or User ID search
- Multi-platform result filtering
- Real-time integration status monitoring
- Responsive design
- Client-side state management

---

## 🗄️ Database Schema

The PostgreSQL database includes these tables:

### Users
```sql
CREATE TABLE User {
  id: String (UUID)
  email: String (unique)
  name: String
  image: String
  createdAt: DateTime
  updatedAt: DateTime
}
```

### SavedSearch
- Stores user's saved search queries
- Links to User

### SyncLog
- Tracks sync operations from each platform
- Status: success, failed, pending
- Source: front, intercom, luciq
- Timestamps for last and next sync

### CachedData
- Stores search results for fast repeat queries
- Fields: source, identifier (email/ID), data JSON
- Updated on each sync

### AuditLog
- Records all user actions
- Action: search, delete_user, view_details
- Resource: email or user ID acted upon
- Timestamps and user tracking

---

## 🔄 Integration Workflow

```
User Search Input
       ↓
Frontend (http://localhost:3000)
       ↓
POST /api/search → Backend (http://localhost:3001)
       ↓
Check Cache (PostgreSQL)
       ↓ (if not cached)
   ├→ Front API
   ├→ Intercom API
   └→ Luciq API
       ↓
   Cache Results
       ↓
   Return Unified Results
       ↓
Display on Frontend
```

Separate background sync:
```
Every 5 minutes
       ↓
Fetch from each platform
       ↓
Update cache in PostgreSQL
       ↓
Log sync status
       ↓
Frontend updates status widget
```

---

## 📊 Data Flow

### Search Request
1. User enters email/ID in SearchBar.tsx
2. Frontend calls POST /api/search via Axios
3. Backend UnifiedSearchService checks cache
4. If miss, queries Front/Intercom/Luciq in parallel
5. Results cached in PostgreSQL
6. Returns combined results
7. Frontend displays in SearchResults.tsx

### Status Updates
1. Frontend IntegrationStatus.tsx polls /api/integrations/status
2. Backend queries latest SyncLog entries
3. Shows status for each integrated platform
4. Frontend updates every 30 seconds

### Background Sync
1. SyncService starts on server boot
2. Node-cron runs every 5 minutes
3. Fetches data from all platforms
4. Updates CachedData table
5. Logs operation in SyncLog
6. Frontend sees updated status

---

## 🚀 Deployment

### Frontend (Vercel)
- Connect GitHub repository
- Automatic deployments on push
- Environment: NEXT_PUBLIC_API_URL

### Backend (Self-hosted)
```bash
npm run build
NODE_ENV=production npm start
```
- Express server on configured PORT
- PostgreSQL connection via DATABASE_URL
- All API keys from environment

---

## 📦 Dependencies Summary

### Backend Core
- express v4.18.0 - HTTP server
- @prisma/client v5.7.0 - Database ORM
- axios v1.6.0 - HTTP client for APIs
- node-cron v3.0.0 - Task scheduling
- winston v3.11.0 - Logging
- cors v2.8.5 - CORS middleware

### Frontend Core
- next v14.0.0 - React framework
- react v18.2.0 - UI library
- react-hook-form v7.48.0 - Form handling
- axios v1.6.0 - HTTP client
- tailwindcss v3.3.0 - CSS framework

---

## 🔐 Environment Variables

### Backend Required
```env
DATABASE_URL=           # PostgreSQL connection
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
JWT_SECRET=dev-secret
FRONT_API_KEY=
INTERCOM_ACCESS_TOKEN=
LUCIQ_API_KEY=
RETOOL_API_KEY=
```

### Frontend Required
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 📝 Key Files to Modify

1. **API Keys** - Edit `backend/.env` with real credentials
2. **Database** - Update `DATABASE_URL` in `backend/.env`
3. **Styling** - Modify `tailwind.config.js` for branding
4. **Components** - Add new components in `frontend/components/`
5. **Services** - Add new integrations in `backend/src/services/`
6. **Schema** - Modify `backend/prisma/schema.prisma` for new fields

---

## 🧪 Testing

### API Testing
```bash
# Health check
curl http://localhost:3001/health

# Integration status
curl http://localhost:3001/api/integrations/status

# Search endpoint
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

### Database Testing
```bash
# Open Prisma Studio
cd backend && npm run prisma:studio
# Opens at http://localhost:5555
```

---

## 🐛 Debugging

### Backend
- Logs: `backend/combined.log`
- Errors: `backend/error.log`
- Run with: `npm run dev` (watch mode with tsx)
- Prisma issues: `npx prisma status`

### Frontend
- Browser DevTools: F12
- Network tab: Check API calls
- Console: JavaScript errors
- Run with: `npm run dev` (watch mode)

---

## 📈 Project Statistics

- **Total Files:** 30+
- **Lines of Code:** ~2000+
- **Backend Services:** 5 (Front, Intercom, Luciq, Unified, Sync)
- **API Endpoints:** 4
- **React Components:** 3
- **Database Tables:** 5
- **Stack:** TypeScript, Next.js, Express, PostgreSQL, Prisma

---

## ✅ Checklist Before Launch

- [ ] Node.js 18+ installed
- [ ] PostgreSQL running
- [ ] `npm install --workspaces` completed
- [ ] Prisma migrations applied
- [ ] All API keys added to .env
- [ ] DATABASE_URL configured
- [ ] Backend starts: `http://localhost:3001/health` returns ok
- [ ] Frontend starts: `http://localhost:3000` loads
- [ ] Search works (at least loads)
- [ ] Integration status shows on sidebar

---

## 📞 Quick References

- **Main Docs:** README.md
- **Setup Instructions:** API_SETUP_GUIDE.md
- **What's Built:** BUILD_SUMMARY.md
- **How to Use:** USER_GUIDE.md
- **This File:** FILE_STRUCTURE.md
- **Setup Script:** setup.sh

---

**Status:** ✅ Complete and ready to configure!

All necessary files are in place. Next step: Add API keys and run!
