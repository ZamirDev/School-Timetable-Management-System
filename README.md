# 📚 School Timetable Management System

An intelligent web application that **automatically generates optimized school timetables** while respecting teacher quotas, availability constraints, and scheduling rules. Built with React, Node.js, Express, and MongoDB.

## ✨ Features

- **Automated Timetable Generation**: Uses intelligent scheduling algorithms to create conflict-free timetables
- **Teacher Management**: Add, edit, and manage teacher information with subject assignments
- **Class Configuration**: Set up multiple classes with customizable periods per day
- **Teacher Quotas**: Define how many periods each teacher teaches per week per class
- **School Timing**: Customize school start times, period duration, and break schedules
- **PDF Export**: Download generated timetables as professional PDF documents
- **Quota Validation**: Real-time summary showing which teachers met their assigned quotas
- **Responsive UI**: Modern, user-friendly interface built with React
- **Multi-class Support**: Generate timetables for multiple classes simultaneously

## 🎯 Problem Solved

**Manual timetable creation is time-consuming and error-prone**. Schools typically spend hours or even days:
- Manually assigning teachers to periods while avoiding conflicts
- Ensuring no teacher teaches back-to-back sessions in different classes
- Balancing teacher workload fairly across the week
- Respecting teacher availability constraints and quotas
- Regenerating everything when a teacher is added or removed

This system **automates the entire process** while respecting all constraints.

## 🛠 Tech Stack

### Frontend
- **React 19.2** - UI framework
- **CSS3** - Styling with modern gradients and responsive design
- **JavaScript ES6+** - Client-side logic

### Backend
- **Node.js & Express 5** - REST API server
- **MongoDB** - Database with Mongoose ODM
- **PDFKit** - PDF generation for timetable exports
- **CORS** - Cross-origin request handling

### Deployment
- **Vercel** - Frontend hosting
- **Render** - Backend API hosting
- **MongoDB Atlas** - Cloud database

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v16+) and npm
- **MongoDB** (local or MongoDB Atlas account)
- **Git**

### 1️⃣ Clone & Install

```bash
git clone <your-repo-url>
cd timetable-system

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 2️⃣ Setup Environment Variables

**Backend** - Create `server/.env`:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/timetable-db
PORT=5000
NODE_ENV=development
```

**Frontend** - Create `client/.env.local`:
```env
REACT_APP_API_URL=http://localhost:5000
```

### 3️⃣ Run Locally

**Terminal 1 - Start Backend**:
```bash
cd server
npm start
# Server runs on http://localhost:5000
```

**Terminal 2 - Start Frontend**:
```bash
cd client
npm start
# App opens on http://localhost:3000
```

---

## 📖 How to Use

### 1. **Add Teachers**
   - Go to **Teachers** tab
   - Enter teacher name and subject
   - Click **Add Teacher**

### 2. **Create Classes**
   - Go to **Classes** tab
   - Enter class name
   - Configure:
     - **Periods per Day**: How many teaching periods (usually 6-8)
     - **School Timing**: Start time, period duration, break timing
     - **Assign Teachers**: Select teachers who teach this class

### 3. **Set Teacher Quotas**
   - For each teacher in each class, specify how many periods they teach per week
   - Leave blank for auto-distribution
   - System validates that quotas don't exceed total available slots

### 4. **Generate Timetable**
   - Go to **Timetable** tab
   - Select a class
   - Click **⚡ Generate Timetable**
   - System creates a conflict-free schedule

### 5. **Download PDF**
   - Once generated, click **📥 Download PDF**
   - Get a formatted timetable ready to print

---

## 🧠 Algorithm & Constraints

The timetable generation algorithm respects:

✅ **Global Constraints**
- No teacher teaches the same period in multiple classes simultaneously
- Maximum 4 periods per teacher per day (across all classes)
- No back-to-back periods for the same teacher in different classes

✅ **Per-Class Constraints**
- All classes get their assigned teachers scheduled
- Teacher quotas are met as closely as possible
- Unassigned teachers get equal distribution of remaining slots

✅ **Fairness**
- Teachers are shuffled when they have equal remaining periods
- Prevents the same teacher always appearing in Period 1, 2, etc.

---

## 📂 Project Structure

```
timetable-system/
├── client/                          # React Frontend
│   ├── public/
│   ├── src/
│   │   ├── App.js                  # Main app component
│   │   ├── components/
│   │   │   ├── Header.jsx
│   │   │   ├── Tabs.jsx
│   │   │   ├── TeacherTabs.jsx     # Manage teachers
│   │   │   ├── ClassesTab.jsx      # Manage classes & config
│   │   │   ├── Timetable.jsx       # View & generate timetables
│   │   │   └── ui/
│   │   │       └── FieldError.jsx
│   │   ├── utils/
│   │   │   └── validation.js       # Client-side validation
│   │   └── index.js
│   ├── package.json
│   └── .env.local
│
├── server/                          # Node.js/Express Backend
│   ├── models/
│   │   ├── Teacher.js              # Teacher schema
│   │   └── Class.js                # Class schema (with timetable)
│   ├── index.js                    # REST API endpoints
│   ├── package.json
│   └── .env                        # MongoDB credentials
│
└── README.md
```

---

## 🔌 API Endpoints

### Teachers
```
GET    /teachers              # Get all teachers
POST   /teachers              # Create new teacher
PUT    /teachers/:id          # Update teacher
DELETE /teachers/:id          # Delete teacher
```

### Classes
```
GET    /classes               # Get all classes
POST   /classes               # Create new class
DELETE /classes/:id           # Delete class
PUT    /classes/:id/assign-teacher           # Assign teacher
PUT    /classes/:id/remove-teacher           # Remove teacher
PUT    /classes/:id/periods-per-day          # Update periods
PUT    /classes/:id/school-timing            # Update timing
PUT    /classes/:id/quota                    # Set teacher quotas
```

### Timetable
```
POST   /generate-timetable    # Generate timetable for all classes
POST   /reset-timetable       # Clear all timetables
GET    /export-pdf/:classId   # Download timetable as PDF
```

---

## 🚢 Deployment

### Deploy Frontend to Vercel

```bash
cd client
npm install -g vercel
vercel --prod
```

Then add environment variable in Vercel dashboard:
```
REACT_APP_API_URL = https://your-backend-url.onrender.com
```

### Deploy Backend to Render

1. Push code to GitHub
2. Connect repository to [Render.com](https://render.com)
3. Set environment variable: `MONGODB_URI`
4. Deploy!

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| **"Cannot POST /teachers"** | Check backend is running on correct port |
| **"Connection refused"** | Verify MongoDB URI in `.env` is correct |
| **CORS errors** | Backend should have CORS enabled (already configured) |
| **Timetable doesn't generate** | Ensure classes have teachers assigned and quotas set |
| **Vercel timeout on timetable generation** | Increase Render backend timeout or optimize algorithm |

---

## 📝 Validation Rules

- **Teacher Name**: Min 2 characters required
- **Subject**: Required field
- **Class Name**: Must be unique
- **Periods per Day**: Between 1-12
- **Teacher Quotas**: Cannot exceed total weekly slots (periodsPerDay × 6 days)
- **School Timing**: Period duration 10-120 min, break 5-60 min

---

## 🤝 Contributing

Feel free to fork and submit pull requests!

---

## 📄 License

This project is open source and available under the MIT License.

---

## 👨‍💻 Author

Created for hackathon submission | Built with ❤️ using MERN Stack

