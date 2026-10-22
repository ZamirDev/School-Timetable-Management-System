# Timetable System — Complete Knowledge Base

> Everything about how this system works. Written so no one needs to re-read the code.

---

## 1. Architecture Overview

```
timetable-system/
├── server/                    # Node.js/Express backend
│   ├── index.js              # ALL routes + scheduling algorithm (1882 lines)
│   ├── models/               # 6 Mongoose models
│   │   ├── User.js           # Admin/Teacher/Student accounts
│   │   ├── Teacher.js        # Teacher name + subject
│   │   ├── Class.js          # Class config + timetable data + quota
│   │   ├── Absence.js        # Teacher absence records
│   │   ├── LeaveRequest.js   # Teacher leave requests
│   │   └── GroupSync.js      # Cross-class group sync rules
│   ├── routes/
│   │   ├── auth.js           # Register, login, users, bulk-import, forgot/reset password
│   │   └── leaveRequests.js  # CRUD for leave requests
│   ├── middleware/
│   │   └── auth.js           # JWT auth + adminOnly middleware
│   └── seed.js               # Creates default admin (admin@admin.com / admin123)
│
├── client/                    # React 19.2 frontend
│   └── src/
│       ├── App.js            # Main app — all state lives here, passed down as props
│       ├── context/
│       │   └── AuthContext.js # JWT login/logout/session restore
│       ├── utils/
│       │   ├── api.js        # fetch wrapper with auth headers
│       │   ├── validation.js # Client-side form validation
│       │   └── styles.js     # Shared style objects (cardStyle, buttonPrimary, etc.)
│       └── components/       # 16 components (detailed below)
│
├── vercel.json               # Vercel deploy config (client)
├── railway.toml              # Railway deploy config (server)
└── .env                      # Server env vars (MONGO_URI, JWT_SECRET)
```

**Tech Stack:**
- Backend: Express 5, Mongoose 9, bcryptjs, jsonwebtoken, pdfkit, cors, dotenv
- Frontend: React 19.2, @dnd-kit (drag-and-drop), react-hot-toast, animate.css, xlsx (Excel export/import)
- Database: MongoDB Atlas (ZamCluster)
- Deployment: Vercel (client), Railway (server, currently parked)
- Package type: server uses `"type": "commonjs"` (require/module.exports)

---

## 2. Data Models (Schemas)

### User.js
```
{
  email:          String (required, unique, lowercase)
  password:       String (required, bcrypt-hashed)
  role:           String enum ["admin", "teacher", "student"] default "admin"
  schoolName:     String (default "")
  createdBy:      ObjectId ref User (default null) — the admin who created this account
  teacherRef:     ObjectId ref Teacher (default null) — links teacher accounts to Teacher doc
  classRef:       ObjectId ref Class (default null) — links student accounts to Class doc
  resetToken:     String (default null)
  resetTokenExpiry: Date (default null)
  plainPassword:  String (default "") — stores original password in plaintext (SECURITY ISSUE)
  timestamps:     true (createdAt, updatedAt auto-generated)
}
```
- Admin accounts: createdBy = null (self-created) or another admin
- Teacher accounts: createdBy = admin's _id, teacherRef = auto-created Teacher doc
- Student accounts: createdBy = admin's _id, classRef = assigned Class doc
- **Multi-tenant isolation**: every query filters by `createdBy: req.effectiveCreatedBy`

### Teacher.js
```
{
  name:      String (required)
  subject:   String (required)
  priority:  Number (default 3) — NOT currently used by algorithm
  createdBy: ObjectId ref User (required)
}
```
- One teacher doc per teacher per school
- Teachers are SHARED across all classes (not per-class)
- No unique index on name+subject+createdBy (potential duplicate issue)

### Class.js
```
{
  name:            String (required)
  periodsPerDay:   Number (default 6)
  teachers:        [ObjectId ref Teacher] — assigned teachers for this class
  timetable: [{
    day:           String — "Monday" through "Saturday"
    periods: [{
      period:      Number — 1-indexed
      startTime:   String — "HH:MM"
      endTime:     String — "HH:MM"
      teacher:     ObjectId ref Teacher
      subject:     String
      tracks: [{           // elective group splits within a period
        groupName: String
        teacher:   ObjectId ref Teacher
        subject:   String
      }]
    }]
  }]
  schoolTiming: {
    startTime:       String (default "08:00")
    periodDuration:  Number (default 40) — minutes
    breakAfter:      Number (default 3) — LEGACY, replaced by breaks array
    breakDuration:   Number (default 20) — LEGACY
    breaks: [{       // NEW: multi-break support
      after:         Number — period number after which break occurs
      duration:      Number — break length in minutes
      label:         String — "Break", "Lunch", etc.
    }]
  }
  teacherGroups: [{  // elective groups within this class
    groupName:       String
    teachers:        [ObjectId ref Teacher] — min 2 teachers per group
  }]
  teacherQuota:      Map<teacherId: Number> — periods per teacher per week
  classTeacher:      ObjectId ref Teacher (default null) — primary teacher for this class
  createdBy:         ObjectId ref User (required)
}
```
- Index: unique compound on `{ name: 1, createdBy: 1 }`
- `teacherQuota` is a Mongoose Map — must convert to plain object with `toPlainQuota()` before JS operations
- timetable stores the GENERATED schedule (overwritten on each generation)
- schoolTiming is UNIFIED across all classes (save endpoint updates all at once)

### Absence.js
```
{
  teacher:   ObjectId ref Teacher (required)
  day:       String enum ["Monday"..."Saturday"] (required)
  createdBy: ObjectId ref User (required)
  timestamps: true
}
```
- Index: unique compound on `{ teacher: 1, day: 1 }` — same teacher can't be absent twice on same day
- Used by the scheduling algorithm to skip absent teachers
- Created manually by admin OR automatically when a leave request is approved

### LeaveRequest.js
```
{
  teacher:     ObjectId ref Teacher (required)
  requestedBy: ObjectId ref User (required) — the teacher who submitted
  startDay:    String enum ["Monday"..."Saturday"] (required)
  endDay:      String enum ["Monday"..."Saturday"] (required)
  reason:      String (default "")
  status:      String enum ["pending", "approved", "rejected"] default "pending"
  adminNote:   String (default "")
  createdBy:   ObjectId ref User (required)
  timestamps:  true
}
```
- Supports multi-day ranges (startDay to endDay)
- On APPROVAL: automatically creates Absence records for each day in the range
- On REJECTION: no absence records created

### GroupSync.js
```
{
  syncId:      String (required) — unique identifier (timestamp-based)
  groupName:   String (required)
  classIds:    [ObjectId ref Class] (required, min 2)
  teacherIds:  [ObjectId ref Teacher] (required, min 2)
  createdBy:   ObjectId ref User (required)
  timestamps:  true
}
```
- Index: unique compound on `{ syncId: 1, createdBy: 1 }`
- Purpose: ensures the same teacher group appears at the SAME day+period across multiple classes
- Example: Math/Science elective in Class A and Class B both at Monday Period 3

---

## 3. Authentication System

### Middleware (middleware/auth.js)
```javascript
auth(req, res, next):
  - Extracts Bearer token from Authorization header
  - Verifies JWT with JWT_SECRET
  - Loads user from DB (selects -password)
  - Sets req.user = full user doc
  - Sets req.effectiveCreatedBy = admin's _id (if admin) or user.createdBy (if teacher/student)
  - This is the KEY to multi-tenant isolation

adminOnly(req, res, next):
  - Checks req.user.role === "admin"
  - Returns 403 if not
```

### JWT Secret
- Default fallback: `"timetable-secret-key-change-in-production"` (from middleware/auth.js)
- Should be overridden by env var `JWT_SECRET` in production

### Auth Flow
1. **Register** (POST /auth/register) — admin-only, creates accounts:
   - For teachers: auto-creates a Teacher doc, links via teacherRef
   - For students: requires classRef (Class._id), links via classRef
   - Stores plainPassword in plaintext (known security issue)
2. **Login** (POST /auth/login) — returns JWT (7-day expiry) + user object
3. **Session restore** (GET /auth/me) — verifies token, returns user
4. **Forgot password** (POST /auth/forgot-password) — generates crypto token, stores on User doc, logs to console, returns token in response (NO email sending)
5. **Reset password** (POST /auth/reset-password) — uses token to set new password

### AuthContext.js (Frontend)
- Stores token + user in localStorage under keys `timetable_token` and `timetable_user`
- On mount: checks localStorage, verifies token with /auth/me, clears if invalid
- apiFetch() adds Bearer token to every request, auto-logs-out on 401

---

## 4. API Routes (All in server/index.js unless noted)

### Teacher Routes
```
GET    /teachers                    → List all teachers for this admin
POST   /teachers                    → Create teacher (name + subject, validated)
PUT    /teachers/:id                → Update teacher name/subject
DELETE /teachers/:id                → Delete teacher + their absences
```

### Class Routes
```
GET    /classes                     → List all classes (populated with teachers, timetable, groups)
GET    /classes/:id                 → Get single class (used by students)
POST   /classes                     → Create class (name only, validated for uniqueness)
DELETE /classes/:id                 → Delete class
PUT    /classes/:id/assign-teacher  → Add teacher to class
PUT    /classes/:id/remove-teacher  → Remove teacher + clean quota
PUT    /classes/:id/periods-per-day → Set periods per day (1-12)
PUT    /classes/:id/school-timing   → Set timing for ONE class
PUT    /update-all-classes-timing   → Set timing for ALL classes at once
PUT    /classes/:id/quota           → Set teacher quota (Map<teacherId, periods>)
GET    /classes/:id/quota           → Get quota for a class
PUT    /classes/:id/teacher-groups  → Set teacher groups for a class
PUT    /classes/:id/class-teacher   → Set class teacher (unique per school)
```

### Timetable Routes
```
POST   /generate-timetable          → THE BIG ONE — generates all timetables
POST   /reset-timetable             → Clears all timetable data
GET    /generate-progress           → Progress polling during generation
PUT    /classes/:id/edit-period     → Edit a single period (teacher/subject/tracks)
PUT    /classes/:id/swap-periods    → Swap two periods within same day (admin UI)
PUT    /classes/:id/move-period     → Drag-and-drop move/swap across days
GET    /export-pdf/:classId         → Generate + download PDF
```

### Absence Routes
```
GET    /absences                    → List all absences
POST   /absences                    → Mark teacher absent on a day
DELETE /absences/:id                → Remove absence record
```

### Leave Request Routes (in routes/leaveRequests.js)
```
GET    /leave-requests              → Teachers see own, admins see all
POST   /leave-requests              → Teacher submits request (startDay, endDay, reason)
PUT    /leave-requests/:id          → Admin approves/rejects
                                     On approve: auto-creates Absence records for each day
```

### Group Sync Routes
```
GET    /group-syncs                 → List all syncs
POST   /group-syncs                 → Create sync (2+ classes, matching teacher group)
DELETE /group-syncs/:syncId         → Remove sync
```

### Auth Routes (in routes/auth.js)
```
POST   /auth/register               → Create user (admin-only)
POST   /auth/login                  → Login, get JWT
GET    /auth/me                     → Current user info
DELETE /auth/users/:id              → Delete user + all their data
GET    /auth/users                  → List all users (admin-only)
POST   /auth/bulk-import            → Bulk import from spreadsheet
POST   /auth/forgot-password        → Generate reset token
POST   /auth/reset-password         → Use token to reset
```

### Import/Export Routes
```
POST   /import                      → Full data import (7-sheet Excel format)
GET    /export-pdf/:classId         → PDF timetable for one class
```
(The Excel export is done client-side in Timetable.jsx using xlsx library)

### Health Check
```
GET    /health                      → Returns { ok: true }
```

---

## 5. The Scheduling Algorithm (POST /generate-timetable)

This is the most complex part of the system. Here's exactly how it works:

### Setup Phase
1. Load ALL classes (with populated teachers), ALL absences
2. Build `absentTeacherDays` Set: `"teacherId_day"` strings
3. Build tracking structures:
   - `teacherTimeTable[tid][day_period] = true` — globally booked slots
   - `teacherDayLoad[tid_day]` — periods assigned today across ALL classes
   - `teacherClassDayCount[tid_cid_day]` — periods per class per day (max 2)
   - `lastPeriodTeacher[cid_day_period]` — for back-to-back prevention
4. Build `targetMapByClass[cid]`:
   - Teachers WITH explicit quota: target = their quota number
   - Teachers WITHOUT quota: target = totalSlots (unlimited up to max)
5. Build teacher group lookups: `teacherToGroup[cid][tid]` and `groupedTeacherIds[cid]`
6. Build group sync lookups from GroupSync documents
7. Generate time slots for each class using `generateTimeSlots()`

### Main Loop: Day → Period → All Classes

```
For each day (Monday through Saturday):
  Shuffle class order (so no class always gets last pick)
  
  For each period (1 to maxPeriods):
    // SYNC LEADER PASS
    For each sync rule:
      Try to claim an unclaimed slot for the sync's classes
      If all teachers available → assign leader class, mark slot claimed
    
    // NORMAL CLASS LOOP (shuffled order)
    For each unhandled class:
      Sort teachers by remaining quota (shuffled within ties)
      
      CHECK 1: Sync follower — mirror leader's placement if slot claimed
      CHECK 2: Normal assignment — group teachers first, then individual
      CHECK 3: Fallback — relax some constraints
      
      If no teacher assigned → Free Period
```

### Teacher Assignment Rules (in priority order)

**Hard constraints (never violated):**
- Teacher cannot teach 2 classes at same day+period (global check via `teacherTimeTable`)
- Teacher cannot teach more than 4 periods per day across ALL classes (`teacherDayLoad`)
- Teacher cannot teach more than 2 periods per class per day (`teacherClassDayCount`)
- Teacher cannot teach back-to-back in different classes (checked via `lastPeriodTeacher`)
- Absent teachers are completely skipped

**Soft constraints (relaxed in fallback):**
- Teacher quota targets (in fallback, teachers without quota can exceed)
- Same subject back-to-back prevention (same subject is OK)

**Teacher Groups:**
- When a grouped teacher is assigned, ALL group members are assigned simultaneously
- Group members share the same day+period across the class
- If ANY group member fails a constraint, the entire group is skipped

**Group Sync:**
- Leader class claims the slot first, follower classes mirror at same day+period
- Sync followers don't update global tracking (teacherTimeTable) since the leader already did
- This allows cross-class sync without double-counting

### Sorting (sortWithShuffle function)
- Groups teachers by effective remaining periods
- Within each group of equal-remaining teachers, shuffle randomly (Fisher-Yates)
- Teachers with explicit quotas get boosted above auto-distribution teachers
- Priority boost: `effectiveRem + 1000` for quota-assigned teachers

### Time Slot Generation (generateTimeSlots function)
- Takes schoolTiming config + periodsPerDay
- Calculates start/end times by adding periodDuration sequentially
- Inserts break durations between periods based on breaks array
- Returns array of {period, startTime, endTime}

### Quota Summary (returned after generation)
- For each class, shows each teacher's target vs actual assignments
- Displayed in the UI as a green table with [OK]/[!]/[X] indicators

---

## 6. Frontend Components

### App.js (665 lines)
- Lives in `client/src/App.js`
- **ALL application state lives here** — passed down as props
- Handles: auth routing, tab navigation, all CRUD operations, validation, dark mode
- Tab routing is manual (currentTab state), not React Router
- Key state: teachers, classes, selectedClass, configuring, quotaInputs, ppd, schoolTiming, absences, etc.
- Key functions: submitTeacher, addClass, assignTeacher, removeTeacher, saveTeacherGroups, saveQuota, savePpd, saveSchoolTiming, detectConflicts, generateTimetable

### AuthContext.js (73 lines)
- Provides: user, token, loading, login(), logout()
- Session stored in localStorage (TOKEN_KEY, USER_KEY)
- On mount: checks localStorage, verifies with /auth/me

### api.js (22 lines)
- Wraps fetch() with Authorization header
- Auto-clears session on 401 response
- Uses REACT_APP_API_URL env var (defaults to localhost:5000)

### Header.jsx (339 lines)
- Dark header bar with gradient
- Shows role-based title ("Admin Panel" / "Teacher Panel" / "Student Panel")
- Email display + Logout button
- Dark mode toggle
- Help & Guide modal (comprehensive usage instructions)

### Tabs.jsx (174 lines)
- Sidebar navigation
- Student view: only "Timetable" tab
- Teacher view: "My Timetable", "My Requests", "Timetable" (view-only)
- Admin view: "Timetable", "Classes", "Teachers", "Teacher Leave", "Leave Requests", "Sync Groups", "Accounts"
- Active tab has gradient background (#0ea5e9 → #06b6d4)

### TeacherTabs.jsx (196 lines)
- Add/edit teacher form (name + subject)
- Teacher list table with edit/delete buttons
- View-only mode for non-admins

### ClassesTab.jsx (289 lines)
- Add class form (name input)
- Unified School Timing section (start time, period duration, breaks management)
- Class list with Configure/Delete buttons
- Opens ClassConfigPanel when Configure is clicked

### ClassConfigPanel.jsx (352 lines)
- Expandable panel for each class
- Sections: Periods Per Day, Assign Teachers, Teacher Groups, Teacher Quota
- Teacher Groups: create/edit groups of 2+ teachers who share slots
- Quota: per-teacher period count input with save

### Timetable.jsx (1236 lines) — THE LARGEST COMPONENT
- Handles: timetable display, generation, editing, import/export, conflict detection
- DnDCell component: uses @dnd-kit for drag-and-drop cell editing
- Features:
  - Generate All Timetables button → calls POST /generate-timetable
  - Progress bar during generation (polls /generate-progress every 300ms)
  - Check Conflicts → client-side cross-class teacher conflict detection
  - Edit Cells mode → double-click any cell to edit teacher/subject/tracks
  - Drag-and-drop → move/swap periods across days
  - Download PDF → per-class PDF export
  - Export All Data → Excel export (client-side, 7 sheets)
  - Import Data → Excel import (upload .xlsx, restore all data)
  - Quota Summary display after generation
  - Student view: shows only their class timetable
  - Break cells rendered inline in the table

### MyTimetable.jsx (173 lines)
- Teacher's personal weekly schedule view
- Scans ALL classes to find where this teacher appears
- Shows class name + subject + group info for each slot

### TeacherDashboard.jsx (207 lines)
- Teacher's leave request submission form
- Multi-day range selection (startDay → endDay)
- Shows submitted requests with status (pending/approved/rejected)

### LeaveRequestsPanel.jsx (175 lines)
- Admin view of all leave requests
- Filter by status (pending/approved/rejected/all)
- Approve button → auto-creates absence records
- Reject button → optional admin note

### AbsencesTab.jsx (184 lines)
- Admin: mark teacher absent on a day
- Table of all recorded absences with delete button
- View-only for non-admins

### GroupSyncPanel.jsx (282 lines)
- Admin: sync teacher groups across classes
- Select Class A + Group A, Class B + Group B
- Validates groups match (same teachers) before allowing sync
- Shows active syncs with delete option

### AccountManagement.jsx (497 lines)
- Admin: create user accounts (teacher/admin/student)
- Teacher accounts: auto-creates Teacher doc
- Student accounts: select class from dropdown
- User list with teacher/admin sections
- Delete users with confirmation
- Bulk Import integration (BulkImport.jsx)

### BulkImport.jsx (259 lines)
- Upload .xlsx file to bulk-create teacher/student accounts
- Columns: Type, Name, Subject, Class, Email, Password
- Preview table before import
- Shows results (imported/skipped/errors)

### ForgotPassword.jsx + ResetPassword.jsx
- Two-step flow: email → token → new password
- Token displayed in UI (no email integration)

### FieldError.jsx (ui/)
- Simple error message display component

---

## 7. Styling System

### CSS Files
- `index.css` — global styles, CSS variables for theming
- `App.css` — app-level styles
- `dark-mode.css` — dark theme variables (data-theme="dark")
- `responsive.css` — media queries for mobile

### CSS Variables (light mode)
```css
--bg-page, --bg-card, --bg-sidebar, --bg-tab-inactive, --bg-input, --bg-modal
--bg-table-hover, --bg-error
--text-primary, --text-secondary, --text-tertiary, --text-table-header, --text-error, --text-success, --text-break
--border-light, --border, --border-color
```

### Shared Style Objects (utils/styles.js)
- `cardStyle` — white card with border + shadow
- `buttonPrimary` — blue gradient button
- `buttonSecondary` — gray outlined button
- `inputStyle` — standard input field
- `withValidation(style, error)` — adds red border + error bg if error

### Responsive CSS
- `.app-layout` — sidebar hidden on mobile, shown as top bar
- `.responsive-table` — horizontal scroll on mobile
- `.form-grid-3`, `.form-grid-2` — collapse to single column on mobile
- `.header-inner`, `.header-title-area`, `.header-controls` — responsive header

---

## 8. Key Algorithms & Helpers

### toPlainQuota(teacherQuota)
- Converts Mongoose Map to plain JS object
- MUST be called before accessing teacherQuota values
- Without this, `quota[tid]` returns undefined

### isBlank(value)
- Returns true if value is empty/whitespace after trimming

### validateTeacherInput({ name, subject })
- Name: required, min 2 chars
- Subject: required

### validatePeriodsPerDayValue(periods)
- Must be integer 1-12

### validateTimingInput({ startTime, periodDuration, breaks... }, periodsPerDay)
- Start time: required, HH:MM format
- Period duration: 10-120 minutes
- Breaks: position within periods, duration 5-60 min, unique positions

### classNameExists(name, userId)
- Case-insensitive unique check with regex escaping

### sortWithShuffle(teachers, targetMap, assignedMap, classDayKey, teacherClassDayCount, priorityIds)
- Groups teachers by effective remaining periods
- Shuffles within each group (Fisher-Yates)
- Boosts quota-assigned teachers above auto-distribution

### resolveBreaks(schoolTiming)
- Returns sorted breaks array
- Falls back to legacy single-break if breaks array is empty

### generateTimeSlots(schoolTiming, periodsPerDay)
- Calculates period start/end times sequentially
- Inserts break durations at correct positions

---

## 9. Export/Import System

### Excel Export (client-side, Timetable.jsx handleExport)
- Fetches all data via parallel API calls
- Creates 7-sheet workbook: Teachers, Classes, Timetable, Accounts, Absences, Teacher Groups, Group Syncs
- Accounts sheet includes base64-encoded passwords
- Downloads as `timetable-export-YYYY-MM-DD.xlsx`

### Excel Import (server POST /import, triggered from client)
- Accepts 7-sheet format (same as export)
- Creates or updates records (upserts by name matching)
- Teachers: created if not exist by name+subject
- Classes: created if not exist by name
- Accounts: created if email not exists
- Timetable: maps class names to IDs, teacher names to IDs
- Teacher Groups: maps class names, resolves teacher IDs
- Group Syncs: creates sync records
- Absences: upserts by teacher+day

### PDF Export (server GET /export-pdf/:classId)
- Uses PDFKit to generate A4 PDF
- Header banner with class name + timing info
- Color-coded cells by subject
- Break rows in orange
- Footer with generation date

---

## 10. Deployment Configuration

### Vercel (client)
- `vercel.json`: rewrites all routes to index.html (SPA)
- Build command: `npm run build`
- Env var: REACT_APP_API_URL = backend URL

### Railway (server)
- `railway.toml`: start command `node server/index.js`
- Env vars: MONGO_URI, JWT_SECRET, PORT
- Currently PARKED (not running)

### Environment Variables
**Server (.env):**
```
MONGO_URI=mongodb+srv://...
JWT_SECRET=your-secret-here
PORT=5000
```

**Client (.env.local):**
```
REACT_APP_API_URL=https://your-backend-url
```

---

## 11. Multi-Tenant Isolation

Every database query filters by `createdBy: req.effectiveCreatedBy`:
- For admins: createdBy = their own _id
- For teachers/students: createdBy = the admin who created them

This means:
- One MongoDB database holds multiple schools' data
- Each school only sees their own teachers, classes, timetables
- Teachers/students cannot see other schools' data
- Data is completely isolated per admin account

---

## 12. Known Issues & Gaps

### Security
1. **plainPassword stored in plaintext** — the User model stores the original password as plainPassword field. This is a major security concern. The Excel export also base64-encodes (not encrypts) this.
2. **JWT secret has hardcoded fallback** — `timetable-secret-key-change-in-production`
3. **No rate limiting** on login/register endpoints
4. **No HTTPS enforcement** on backend

### Functionality
5. **No mobile PWA** — works on mobile but not installable
6. **No demo mode** — can't try without creating accounts
7. **No room/lab management** — only teacher-based scheduling
8. **No NEP 2020 compliance** — no subject codes, skill areas
9. **No multi-branch support** — one school = one admin
10. **No WhatsApp/email notifications** — only in-app
11. **No teacher priority enforcement** — `priority` field exists but unused
12. **No audit log** — no record of who changed what
13. **No undo for timetable generation** — generates overwrite everything

### Code Quality
14. **server/index.js is monolithic** — 1882 lines, all routes + algorithm in one file
15. **Timetable.jsx is monolithic** — 1236 lines, multiple concerns mixed
16. **App.js has too much state** — 665 lines, all state management in one component
17. **No tests** — no test files exist
18. **No input sanitization** — relies only on validation, not XSS protection
19. **In-memory progress store** — `generationProgress` object resets on server restart

### Deployment
20. **Railway backend parked** — not currently running
21. **No CI/CD** — manual deployment
22. **No database backups** configured

---

## 13. Feature Addition Guide

### How to add a new API route
1. Open `server/index.js`
2. Add route after existing routes (before health check at end)
3. Use `auth` and/or `adminOnly` middleware as needed
4. Always filter by `req.effectiveCreatedBy` for multi-tenant isolation
5. Add error handling with try/catch

### How to add a new React component
1. Create file in `client/src/components/`
2. Import in `App.js`
3. Add state in `App.js` if needed
4. Pass state + handlers as props
5. Add tab routing in `App.js` based on `currentTab`
6. Add tab button in `Tabs.jsx`

### How to add a new Mongoose model
1. Create file in `server/models/`
2. Require in `server/index.js`
3. Add CRUD routes in `server/index.js`
4. Add to import/export logic if needed
5. Add to user deletion cleanup in routes/auth.js

### How to add a new database field
1. Add to Mongoose schema in model file
2. No migration needed (MongoDB is schema-flexible)
3. Update API routes to handle new field
4. Update frontend components to display/edit
5. Add validation if needed

---

## 14. API Response Formats

### Success
- `GET /teachers` → `[{ _id, name, subject, createdBy }]`
- `GET /classes` → `[{ _id, name, periodsPerDay, teachers: [...], timetable: [...], schoolTiming: {...}, teacherGroups: [...], teacherQuota: {...} }]`
- `POST /generate-timetable` → `{ message: "Timetable Generated Successfully", quotaSummary: { "ClassName": { teachers: [{ name, subject, target, got, quota }] } } }`
- `POST /auth/login` → `{ token: "jwt...", user: { _id, email, role, schoolName, teacherRef, classRef } }`

### Error
- `{ error: "Error message" }` with appropriate HTTP status code

---

## 15. Session State Summary (as of Aug 2026)

### Active Threads
- **Bhavik Khera** (SEE Linkages MD, Shark Tank judge) — pitch/pricing shared last week; **Bhavik proposed a meeting Saturday (WhatsApp/Teams); Zamir countered with Zoom/Meet and asked if just him or a school pitch + whether CFO (Henil Soni) should join. Awaiting Bhavik's reply on format/attendees.** Pitch ready, everything prepared.
- **Podar head office email** — sent Aug 24 to info@podarworld.org, waiting for reply
- **Timetable feature development** — was about to review codebase before adding features

### Gaps to Address (for school outreach)
1. Demo mode (schools can try without accounts)
2. Mobile responsiveness (most Indian school admins use phones)
3. WhatsApp integration (teacher absence alerts)
4. Room/lab management
5. NEP 2020 compliance

### Pricing
- ₹999/month flat (vs competitors at ₹15-50K/month for 500-student school)
- Unit economics: ₹349 net profit per subscription
- Market: ₹4,800 crore

### Deployment
- Vercel: timetable-client (LIVE)
- Railway: backend (PARKED)
- MongoDB Atlas: ZamCluster (LIVE)

---

*Last updated: Sep 4, 2026*
*Created by: OpenCode session for Zamir Memon*
