# WeSupport — Comprehensive Gap Analysis & Feature Roadmap

> Generated: 2026-03-03
> Compared against: Gmail, Intercom, Front, Zendesk

---

## 1. SETTINGS — Currently Barebones

**What exists today:** Name, email (read-only), signature textarea, light/dark theme toggle, change password. That's it — 209 lines.

### Missing Features (vs Gmail/Intercom/Front)

#### Personal Settings

| Feature | Gmail | Intercom | Front | WeSupport |
|---------|-------|----------|-------|-----------|
| Profile avatar upload | Yes | Yes | Yes | **Missing** |
| Timezone selection | Yes | Yes | Yes | **Missing** |
| Language/locale preference | Yes | Yes | Yes | **Missing** |
| Date/time format preference | Yes | No | Yes | **Missing** |
| Desktop notifications toggle | Yes | Yes | Yes | **Missing** |
| Sound notifications toggle | Yes | Yes | Yes | **Missing** |
| Email notifications (digest) | Yes | Yes | Yes | **Missing** |
| Vacation/OOO auto-responder | Yes | No | Yes | **Missing** |
| Working hours configuration | No | Yes | Yes | **Missing** |
| Two-factor authentication (2FA) | Yes | Yes | Yes | **Missing** |
| Active sessions management | Yes | Yes | Yes | **Missing** |
| Connected accounts (OAuth) | Yes | No | Yes | **Missing** |
| Keyboard shortcut customization | Yes | No | Yes | **Missing** |
| Rich HTML signature editor (WYSIWYG) | Yes | Yes | Yes | **Plaintext only** |

#### Workspace/Organization Settings (Admin)

| Feature | Front | Intercom | WeSupport |
|---------|-------|----------|-----------|
| Company name/logo/branding | Yes | Yes | **Missing** |
| Default reply-from address | Yes | Yes | **Missing** |
| Business hours / SLA rules | Yes | Yes | **Missing** |
| Auto-assignment rules | Yes | Yes | **Missing** |
| Routing rules (keyword → team) | Yes | Yes | **Missing** |
| Canned response categories management | Yes | Yes | **Basic only** |
| Custom fields definition | Yes | Yes | **Missing** |
| Conversation tags management | Yes | Yes | **Missing** |
| Blocked contacts list | Yes | No | **Missing** |
| Data retention policies | No | Yes | **Missing** |
| Export/import settings | No | Yes | **Missing** |
| Webhook configuration UI | No | Yes | **Missing** |

#### Notification Preferences

| Feature | Description | Priority |
|---------|-------------|----------|
| Per-channel notification toggle | Mute Intercom but keep email alerts | High |
| @mention notifications | Get notified when someone mentions you | High |
| Assignment notifications | Alert when a conversation is assigned to you | High |
| SLA breach alerts | Warning when response time nears SLA limit | High |
| Daily digest email | Summary of unresolved tickets | Medium |
| Browser push notifications | Real-time desktop alerts | Medium |
| Slack/webhook notification integration | Forward alerts to Slack channel | Medium |

---

## 2. DASHBOARD — Looks Good, But Mostly Mock Data

**What exists today:** 4 stat cards with sparklines, area chart (7-day volume), donut charts (channel + SLA), response time bars, tag breakdown, KYC stats section, benchmark strip. **BUT: Almost all data is hardcoded/mock.**

### Critical Issues

1. **All trend data is mock** — `dailyTrend` returns hardcoded arrays, not real aggregations
2. **Response times are fake** — No actual first-response-time tracking in DB
3. **SLA health is fabricated** — No SLA rules defined, so no real breach tracking
4. **Tag breakdown is mock** — No tagging system exists at all
5. **KYC stats are hardcoded** — No real KYC verification pipeline
6. **No date range picker** — Fixed to "7 days" with no user control

### Missing Features (vs Intercom/Front/Zendesk dashboards)

#### Data & Filtering

| Feature | Description | Priority |
|---------|-------------|----------|
| Date range picker | Custom date range (today, 7d, 30d, 90d, custom) | **Critical** |
| Real-time data (WebSockets) | Live updates without page refresh | High |
| Per-agent performance breakdown | Response times, resolution rates per agent | High |
| Team/department filtering | Filter dashboard by team | Medium |
| Comparison mode | Compare current period vs. previous | Medium |
| Custom dashboard builder | Drag-and-drop widget layout | Low |

#### Missing KPIs & Metrics

| Metric | What It Measures | Gmail | Intercom | Front |
|--------|-----------------|-------|----------|-------|
| First Response Time (real) | Time from customer message to first agent reply | No | Yes | Yes |
| Average Resolution Time | Time from ticket open to close | No | Yes | Yes |
| Customer Satisfaction (CSAT) | Post-resolution rating (1-5 stars) | No | Yes | Yes |
| Net Promoter Score (NPS) | Would you recommend us? | No | Yes | No |
| Conversations per agent | Workload distribution | No | Yes | Yes |
| Busiest hours heatmap | When support volume peaks | No | Yes | Yes |
| Channel distribution over time | Is chat growing vs email? | No | Yes | Yes |
| Unassigned conversation count | Tickets sitting in queue | No | Yes | Yes |
| Reopen rate | % of conversations reopened after close | No | Yes | Yes |
| One-touch resolution rate | % solved in single reply | No | Yes | Yes |
| Agent online/availability status | Who's currently active | No | Yes | Yes |
| Queue wait time | How long customers wait for first reply | No | Yes | Yes |

#### Export & Reporting

| Feature | Description | Priority |
|---------|-------------|----------|
| Export to CSV/Excel | Download any dashboard data | High |
| Export to PDF | Generate printable reports | Medium |
| Scheduled reports (email) | Weekly/monthly report auto-sent to team | Medium |
| Saved dashboard views | Save filter configurations | Low |
| API access to analytics | Expose metrics via REST API | Low |

---

## 3. KYC — Exists as Email Channel Only, No Real KYC Pipeline

**What exists today:** A Gmail inbox filtered to `channel=kyc`. That's it — it's just email with a KYC label. There is **no KYC verification workflow, no document handling, no verification status tracking.**

### What a Real KYC Module Needs

#### Verification Pipeline

| Feature | Description | Priority |
|---------|-------------|----------|
| KYC Status Model | `pending → in_review → approved / rejected / escalated` | **Critical** |
| Document upload & storage | Accept ID photos, proof of address, selfies (S3/R2) | **Critical** |
| Document type classification | Passport, driver license, utility bill, bank statement | **Critical** |
| Verification checklist | Per-customer checklist: ID verified? Address verified? Face match? | **Critical** |
| Rejection reasons | Predefined list: "Blurry image", "Expired document", "Name mismatch" | **Critical** |
| Re-submission workflow | Customer can re-upload after rejection | High |
| Verification notes/comments | Internal notes on each verification attempt | High |
| Verification history/timeline | Full audit trail of status changes with timestamps | High |
| Auto-assign to reviewer | Round-robin or skill-based assignment | High |
| SLA tracking for KYC | "Must review within 24h" with breach alerts | High |

#### KYC Dashboard Section

| Feature | Description | Priority |
|---------|-------------|----------|
| Pending queue count | How many KYC requests are waiting | **Critical** |
| Average verification time | From submission to approval/rejection | High |
| Approval/rejection rates | % breakdown with trends | High |
| Top rejection reasons | Bar chart of common failures | High |
| Agent verification stats | Who's processing the most, who's fastest | Medium |
| Daily/weekly volume trends | KYC submissions over time | Medium |
| Geographic breakdown | Which countries/regions submit most | Low |

#### KYC List View Enhancements

| Feature | Description | Priority |
|---------|-------------|----------|
| Status filter tabs | Pending / In Review / Approved / Rejected / Escalated | **Critical** |
| Risk level indicators | Low / Medium / High risk scoring | High |
| Document preview | Inline image viewer for uploaded docs | High |
| Bulk approve/reject | Select multiple and batch-process | High |
| Priority queue | High-value customers or flagged accounts surface first | Medium |
| Search by name, email, ID number | Full-text search across KYC records | Medium |
| Expiry tracking | Alert when verified documents are about to expire | Medium |

#### Compliance & Audit

| Feature | Description | Priority |
|---------|-------------|----------|
| Full audit trail | Every action logged with user, timestamp, IP | **Critical** |
| Reason required on rejection | Cannot reject without selecting reason | High |
| Supervisor escalation | Agent can escalate to senior reviewer | High |
| Compliance reporting | Exportable reports for regulators | High |
| Data retention policies | Auto-delete sensitive docs after X days | Medium |
| PII masking in logs | Don't log full ID numbers | Medium |

---

## 4. SUPPORT (Email/Gmail Page) — Good Foundation, Missing Power Features

**What exists today:** Gmail-like inbox with tabs (All/Inbox/Spam/Deleted/Drafts/Archived), compose modal with basic formatting, reply composer with template insertion, customer panel, draft management.

### Missing Features (vs Gmail/Front/Intercom)

#### Conversation Management

| Feature | Gmail | Front | Intercom | WeSupport |
|---------|-------|-------|----------|-----------|
| Snooze conversations | Yes | Yes | Yes | **Missing** |
| Schedule send (send later) | Yes | Yes | No | **Missing** |
| Conversation tagging/labeling | Yes | Yes | Yes | **Missing** |
| Star/pin important | Yes | Yes | Yes | **Missing** |
| Conversation merge | No | Yes | Yes | **Missing** |
| Conversation split | No | Yes | No | **Missing** |
| Follow/watch a conversation | No | Yes | Yes | **Missing** |
| Internal notes (not visible to customer) | No | Yes | Yes | **Missing** |
| Collision detection (2 agents replying) | No | Yes | Yes | **Missing** |
| Read receipts | No | No | Yes | **Missing** |
| Typing indicators | No | No | Yes | **Missing** |
| Undo send (5-30 sec window) | Yes | Yes | No | **Missing** |
| Conversation priority levels | No | Yes | Yes | **Missing** |
| Due date / follow-up reminders | No | Yes | Yes | **Missing** |

#### Assignment & Routing

| Feature | Front | Intercom | WeSupport |
|---------|-------|----------|-----------|
| Round-robin auto-assignment | Yes | Yes | **Missing** |
| Skill-based routing | Yes | Yes | **Missing** |
| Load-balancing (least-busy agent) | Yes | Yes | **Missing** |
| Keyword-based routing rules | Yes | Yes | **Missing** |
| VIP customer routing | Yes | Yes | **Missing** |
| Escalation rules (time-based) | Yes | Yes | **Missing** |
| Team inboxes | Yes | Yes | **Missing** |
| Shared drafts | Yes | No | **Missing** |

#### Search & Filtering

| Feature | Gmail | Front | WeSupport |
|---------|-------|-------|-----------|
| Full-text search across all messages | Yes | Yes | **Missing** (email only) |
| Advanced filters (date, from, has:attachment) | Yes | Yes | **Missing** |
| Saved searches / smart views | No | Yes | **Missing** (DB table exists, unused) |
| Search within conversation | Yes | No | **Missing** |
| Filter by assignee | No | Yes | **Missing** |
| Filter by tag/label | Yes | Yes | **Missing** |
| Sort by (date, priority, SLA) | Yes | Yes | **Missing** |

#### Rich Compose & Editor

| Feature | Gmail | Front | WeSupport |
|---------|-------|-------|-----------|
| File attachments | Yes | Yes | **UI exists, backend missing** |
| Inline images | Yes | Yes | **Missing** |
| Rich text (bold/italic/etc) | Yes | Yes | **Basic toolbar, no actual HTML** |
| Mentions (@agent) | No | Yes | **Missing** |
| Emoji picker | Yes | Yes | **Missing** |
| Spell check | Yes | Yes | **Browser only** |
| Canned response variables auto-fill | No | Yes | **Missing** (placeholders not resolved) |
| Multiple signatures | Yes | Yes | **Single only** |
| CC/BCC fields | Yes | Yes | **Missing** |

#### Bulk Operations

| Feature | Front | Gmail | WeSupport |
|---------|-------|-------|-----------|
| Select multiple conversations | Yes | Yes | **Missing** |
| Bulk archive | Yes | Yes | **Missing** |
| Bulk assign | Yes | No | **Missing** |
| Bulk tag | Yes | Yes | **Missing** |
| Bulk delete/trash | Yes | Yes | **Missing** |
| Bulk snooze | No | Yes | **Missing** |
| Select all on page | Yes | Yes | **Missing** |

#### Real-time & Collaboration

| Feature | Front | Intercom | WeSupport |
|---------|-------|----------|-----------|
| Real-time message updates (WebSocket) | Yes | Yes | **Polling only** |
| Agent collision detection | Yes | Yes | **Missing** |
| Shared notes on conversation | Yes | Yes | **Missing** |
| @mention in internal notes | Yes | Yes | **Missing** |
| Presence indicators (who's online) | Yes | Yes | **Missing** |
| Conversation activity feed | Yes | Yes | **Missing** |

---

## 5. ADMIN PORTAL — Functional But Minimal

**What exists today:** 3 tabs — Users (invite/role/delete), Integrations (rotate keys), Audit Logs (filter/paginate).

### Missing Features (vs Front/Intercom Admin)

#### Team & Organization

| Feature | Front | Intercom | WeSupport |
|---------|-------|----------|-----------|
| Teams / Departments | Yes | Yes | **Missing** |
| Team-based permissions | Yes | Yes | **Missing** |
| Custom roles (beyond 3 fixed) | Yes | Yes | **Missing** |
| Granular permissions matrix | Yes | Yes | **Missing** |
| Org hierarchy (multiple teams) | Yes | Yes | **Missing** |
| Agent capacity limits | No | Yes | **Missing** |
| Working schedule per agent | No | Yes | **Missing** |

#### SLA & Rules Engine

| Feature | Front | Intercom | WeSupport |
|---------|-------|----------|-----------|
| SLA policy definition | Yes | Yes | **Missing** |
| Business hours configuration | Yes | Yes | **Missing** |
| Auto-reply rules | Yes | Yes | **Missing** |
| Escalation rules | Yes | Yes | **Missing** |
| Workflow automation builder | Yes | Yes | **Missing** |
| Trigger-based actions | Yes | Yes | **Missing** |
| Round-robin assignment config | Yes | Yes | **Missing** |

#### Integration Management

| Feature | Description | Priority |
|---------|-------------|----------|
| Integration health monitoring | Live status check (green/red/yellow) | High |
| Webhook configuration UI | Add/edit/test webhooks visually | High |
| OAuth flow for integrations | One-click connect (not paste API key) | Medium |
| Integration sync logs (detailed) | Show last sync, errors, record counts | Medium |
| Test connection button | Verify API key works before saving | Medium |
| Rate limit monitoring | Show API usage vs limits | Low |

#### Security & Compliance

| Feature | Description | Priority |
|---------|-------------|----------|
| Two-factor authentication enforcement | Require 2FA for all agents | **Critical** |
| IP allowlist/blocklist | Restrict access by IP range | High |
| Session management | View/revoke active sessions | High |
| Password policy configuration | Min length, complexity, rotation | High |
| SSO (SAML/OIDC) | Enterprise single sign-on | High |
| Data export (GDPR) | Full customer data export | High |
| Data deletion (right to be forgotten) | Purge customer PII | High |
| Login attempt rate limiting | Prevent brute force | High |
| Audit log export | Download logs as CSV for compliance | Medium |
| Role-based data visibility | Agents see only their team's data | Medium |

#### Monitoring & Health

| Feature | Description | Priority |
|---------|-------------|----------|
| System health dashboard | Server uptime, DB status, queue depth | High |
| Error rate monitoring | 5xx errors over time | Medium |
| API usage analytics | Requests per endpoint over time | Low |
| Background job monitoring | Sync job status, failures, retry counts | Medium |

---

## 6. CROSS-CUTTING CONCERNS (Affects All Areas)

### Backend Gaps

| Issue | Impact | Priority |
|-------|--------|----------|
| No request validation (zod/joi) | Invalid data can corrupt DB | **Critical** |
| No rate limiting | Vulnerable to abuse/DDoS | **Critical** |
| No test suite at all | Cannot verify anything works | **Critical** |
| No WebSocket support | No real-time updates anywhere | High |
| Viewer role not enforced | Viewers can do anything agents can | High |
| SavedSearch table exists but unused | Wasted DB model | Medium |
| No pagination on many endpoints | Will break at scale | High |
| No database indexes documented | Slow queries at scale | Medium |
| Template variables not resolved | `{{customer_name}}` sent literally | Medium |
| No email notification service | No alerts for assignments/breaches | High |

### Frontend Gaps

| Issue | Impact | Priority |
|-------|--------|----------|
| Page files are 400-900 lines | Hard to maintain/test | Medium |
| No error boundaries | One crash kills entire page | High |
| No loading skeletons | Jarring loading experience | Medium |
| No optimistic updates | UI feels slow (wait for API) | Medium |
| No offline support/PWA | Unusable without internet | Low |
| No keyboard shortcut help modal | Users don't know shortcuts exist | Medium |
| No onboarding / empty states | New users see blank pages | Medium |
| No breadcrumbs / back navigation | Easy to get lost | Low |
| Mobile responsiveness incomplete | Three-panel layout breaks on mobile | Medium |

---

## 7. PRIORITY IMPLEMENTATION ROADMAP

### Phase 1 — Foundation (Make it Reliable)

- [ ] Request validation layer (zod schemas on all endpoints)
- [ ] Rate limiting middleware
- [ ] Complete RBAC enforcement (viewer vs agent vs admin on every route)
- [ ] Error boundaries on frontend
- [ ] WebSocket infrastructure (Socket.io) for real-time updates
- [ ] Test suite setup (Jest + Supertest backend, Vitest + Testing Library frontend)

### Phase 2 — Core Support Power Features

- [ ] Conversation tagging system (DB model + UI)
- [ ] Snooze conversations (snooze until date/time)
- [ ] Internal notes on conversations
- [ ] Collision detection (agent typing indicator)
- [ ] Bulk operations (select, archive, assign, tag)
- [ ] Advanced search with saved views
- [ ] Real SLA tracking (define rules → measure → alert)

### Phase 3 — KYC Pipeline

- [ ] KYC data model (status, documents, verification attempts)
- [ ] Document upload (S3/R2 integration)
- [ ] Verification workflow UI (review → approve/reject with reason)
- [ ] KYC queue with priority sorting
- [ ] Real KYC analytics on dashboard

### Phase 4 — Settings & Admin Maturity

- [ ] Workspace settings (business hours, SLA policies, branding)
- [ ] Notification preferences (per-channel, @mention, assignment)
- [ ] Team/department structure
- [ ] Custom roles & granular permissions
- [ ] 2FA enforcement
- [ ] SSO integration

### Phase 5 — Intelligence & Scale

- [ ] Workflow automation builder (if X then Y)
- [ ] Auto-assignment rules engine
- [ ] CSAT surveys post-resolution
- [ ] Scheduled reports
- [ ] Dashboard date range picker + real data aggregation
- [ ] Export everything (CSV/PDF)
