# API Integration Checklist

## 🔧 Getting Started with Each Integration

### 1. Front API Setup

**Steps:**
1. Go to https://app.frontapp.com
2. Click Settings (bottom left)
3. Go to **Integrations** → **Developer tools**
4. Click **Create API token**
5. Name it "WeSupport"
6. Copy the token

**Configuration:**
```bash
# In backend/.env
FRONT_API_KEY=your_front_api_token_here
```

**Testing:**
```bash
# Test the API connection
curl -H "Authorization: Bearer YOUR_KEY" \
  https://api2.frontapp.com/contacts?limit=1
```

---

### 2. Intercom Access Token

**Steps:**
1. Go to https://developers.intercom.com
2. Sign in or create an account
3. Create a new **App** (give it name "WeSupport")
4. Go to **Authentication**
5. Generate **Access token**
6. Copy the token

**Configuration:**
```bash
# In backend/.env
INTERCOM_ACCESS_TOKEN=your_token_here
```

**Testing:**
```bash
# Test the API connection
curl -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Intercom-Version: 2.8" \
  https://api.intercom.io/contacts?limit=1
```

---

### 3. Luciq API Key

**Steps:**
1. Contact Luciq support for API access: support@luciq.io
2. Request API key for your account
3. Provide details:
   - Company/workspace name
   - Use case (internal support tool)
   - Data needed (bugs, user info)
4. They'll send you an API key

**Configuration:**
```bash
# In backend/.env
LUCIQ_API_KEY=your_luciq_key_here
```

**Note:** Luciq API endpoint may vary - check their documentation

---

### 4. Retool Integration (Phase 2)

**Steps:**
1. Go to your Retool workspace
2. Settings → **Account**
3. Find **API tokens**
4. Generate new token

**Configuration:**
```bash
# In backend/.env
RETOOL_API_KEY=your_retool_key_here
```

---

## 🗄️ Database Setup

### PostgreSQL Installation

**macOS (with Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Create Database:**
```bash
createdb wesupport
```

**Verify:**
```bash
psql wesupport
# You should see the postgres prompt
# Type: \quit to exit
```

**Configure in .env:**
```bash
# If local setup
DATABASE_URL="postgresql://localhost/wesupport"

# If remote (e.g., AWS RDS)
DATABASE_URL="postgresql://user:password@host:5432/wesupport"
```

---

## 🔐 Environment Variables Template

Create `backend/.env` with these exact variables:

```env
# Database
DATABASE_URL="postgresql://localhost/wesupport"

# Server
PORT=3001
NODE_ENV="development"
JWT_SECRET="dev-secret-key-change-in-production"

# Frontend URL (for CORS)
FRONTEND_URL="http://localhost:3000"

# API Integrations
FRONT_API_KEY="your-front-api-key"
INTERCOM_ACCESS_TOKEN="your-intercom-token"
LUCIQ_API_KEY="your-luciq-key"
RETOOL_API_KEY="your-retool-key"

# Logging
LOG_LEVEL="info"
```

Front `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## ✅ Pre-Launch Checklist

- [ ] All API keys obtained and added to `backend/.env`
- [ ] PostgreSQL database created and connection tested
- [ ] Running `npm install --workspaces` succeeded
- [ ] Running `npm run prisma:migrate` succeeded
- [ ] Backend starts: `cd backend && npm run dev`
- [ ] Frontend starts: `cd frontend && npm run dev`
- [ ] Dashboard loads at http://localhost:3000
- [ ] Health check passes: `curl http://localhost:3001/health`
- [ ] Search feature works (at least returns empty for now)
- [ ] Integration status shows on sidebar

---

## 🧪 Quick Test After Setup

### 1. Test Backend Health
```bash
curl http://localhost:3001/health
```
Expected: `{"status":"ok","timestamp":"..."}`

### 2. Test Integration Status
```bash
curl http://localhost:3001/api/integrations/status
```
Expected: Object with "front", "intercom", "luciq" status

### 3. Test Search (via frontend UI)
- Open http://localhost:3000
- Enter test email or user ID
- Should show "searching..." then results or "no results"

### 4. View Sync Logs
```bash
curl http://localhost:3001/api/integrations/sync-logs
```
Expected: Array of sync operations

---

## 🐛 Troubleshooting

### "Cannot connect to database"
```bash
# Check if PostgreSQL is running
brew services list

# Start if needed
brew services start postgresql@15

# Verify database exists
psql -l | grep wesupport
```

### "API key is invalid"
- Double-check the key is copied completely
- Ensure no extra spaces/quotes in `.env`
- Verify the key hasn't expired

### "CORS error in browser"
- Check `FRONTEND_URL` is correct in `backend/.env`
- Ensure backend is running on `http://localhost:3001`
- Restart backend after `.env` changes

### "Prisma migrate fails"
```bash
# Reset migrations (development only)
cd backend
npm run prisma:migrate -- --skip-generate

# Or manually check migration status
npx prisma migrate status
```

---

## 🚀 Next Commands to Run

```bash
# 1. Install dependencies
npm install --workspaces

# 2. Setup database
cd backend && npm run prisma:generate && npm run prisma:migrate

# 3. Start development
cd .. && npm run dev

# 4. Open browser
# Frontend: http://localhost:3000
# Backend API: http://localhost:3001
```

---

## 📞 Need Help?

- Check `/README.md` for full documentation
- Check `/BUILD_SUMMARY.md` for overview
- Logs in `backend/combined.log` for errors
- Prisma Studio: `cd backend && npm run prisma:studio`

**You're all set!** 🎉
