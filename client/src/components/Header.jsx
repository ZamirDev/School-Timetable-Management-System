import { useState } from "react";

export default function Header({ darkMode, toggleDarkMode, user, onLogout }) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        borderBottom: "1px solid #334155",
        padding: "28px 20px",
        marginBottom: "32px",
        boxShadow: "0 4px 20px rgba(15, 23, 42, 0.15)"
      }}>
        <div className="header-inner" style={{ maxWidth: "1400px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="header-title-area">
            <h1 style={{
              margin: 0,
              fontSize: "32px",
              fontWeight: "700",
              color: "#f0f9ff",
              letterSpacing: "-0.5px"
            }}>
              🏫 {user?.role === "teacher" ? "Teacher Panel" : user?.role === "student" ? "Student Panel" : "Admin Panel"}
            </h1>
            <p style={{
              margin: "8px 0 0 0",
              fontSize: "16px",
              color: "#cbd5e1",
              fontWeight: "500"
            }}>
              {user?.role === "teacher"
                ? "View timetable · Submit leave requests · Download PDFs"
                : user?.role === "student"
                ? "View your class timetable · Download PDFs"
                : "Configure classes and teachers · Generate timetables · Export PDFs"}
            </p>
          </div>
          <div className="header-controls" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {user && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "rgba(255,255,255,0.1)",
                padding: "6px 14px 6px 16px",
                borderRadius: "8px",
                marginRight: "4px",
              }}>
                <span style={{ color: "#cbd5e1", fontSize: "15px", fontWeight: 500 }}>
                  {user.email}
                </span>
                <button
                  onClick={onLogout}
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    color: "#f1f5f9",
                    border: "none",
                    padding: "5px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                  onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.25)"}
                  onMouseLeave={e => e.target.style.background = "rgba(255,255,255,0.15)"}
                >
                  Logout
                </button>
              </div>
            )}
            <button
              onClick={toggleDarkMode}
              style={{
                background: darkMode ? "#f1f5f9" : "#1e293b",
                color: darkMode ? "#1e293b" : "#f1f5f9",
                border: "none",
                padding: "10px 14px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "16px",
                lineHeight: 1,
                transition: "all 0.3s ease",
                marginTop: "4px"
              }}
            >
              {darkMode ? "☀️" : "🌙"}
            </button>
            <button
              onClick={() => setShowHelp(!showHelp)}
              style={{
                background: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
                color: "white",
                border: "none",
                padding: "10px 20px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "15px",
                fontWeight: "600",
                transition: "all 0.3s ease",
                boxShadow: "0 4px 12px rgba(6, 182, 212, 0.3)",
                marginTop: "4px"
              }}
              onMouseEnter={e => e.target.style.transform = "translateY(-2px)"}
              onMouseLeave={e => e.target.style.transform = "translateY(0)"}
            >
              ❓ {showHelp ? "Close Help" : "Help & Guide"}
            </button>
          </div>
        </div>
      </div>

      {/* HELP MODAL */}
      {showHelp && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "var(--bg-modal)",
            borderRadius: "12px",
            padding: "32px",
            maxWidth: "750px",
            maxHeight: "85vh",
            overflowY: "auto",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#0f172a" }}>
                📖 Help & Guide
              </h2>
              <button
                onClick={() => setShowHelp(false)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "#64748b"
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: "14px", color: "#334155", lineHeight: "1.8" }}>

              {/* ROLE OVERVIEW */}
              <section style={{ marginBottom: "24px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginBottom: "10px" }}>
                  👤 Role Overview
                </h3>
                <p style={{ margin: "0" }}>
                  <strong>Admin</strong> — Full access: manage teachers, classes, generate timetables, approve leave requests, and manage accounts.
                </p>
                <p style={{ margin: "8px 0 0 0" }}>
                  <strong>Teacher</strong> — View-only access to timetables, classes, and teacher directory. Teachers can view their own personal schedule in <strong>🗓️ My Timetable</strong> and submit leave requests in <strong>📋 My Requests</strong>.
                </p>
              </section>

              <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "24px 0" }} />

              {/* ADMIN SECTIONS */}
              <section style={{ marginBottom: "20px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginBottom: "10px" }}>
                  👨‍🏫 Teachers Tab
                </h3>
                <p style={{ margin: "0 0 8px 0" }}>
                  Add all teachers to the system before creating classes:
                </p>
                <ul style={{ margin: "8px 0 0 20px", paddingLeft: 0 }}>
                  <li>Enter teacher <strong>name</strong> and <strong>subject</strong></li>
                  <li>Click "Add" to save — edit or delete anytime</li>
                  <li>Teachers are shared across all classes</li>
                </ul>
              </section>

              <section style={{ marginBottom: "20px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginBottom: "10px" }}>
                  📚 Classes Tab
                </h3>
                <p style={{ margin: "0 0 8px 0" }}>
                  Create classes and configure them:
                </p>
                <ul style={{ margin: "8px 0 0 20px", paddingLeft: 0 }}>
                  <li><strong>Add New Class:</strong> Enter class name (e.g., 10A)</li>
                  <li><strong>School Timing:</strong> Set start time, period duration, and break (applies to all classes)</li>
                  <li><strong>Configure (⚙️):</strong> Assign teachers to a class and set periods per day</li>
                  <li><strong>Teacher Quota:</strong> Control how many periods each teacher teaches (optional — skip for auto-distribution)</li>
                  <li><strong>Teacher Groups:</strong> Group teachers who share the same slot (e.g., elective subjects like Math/Bio). All group members are automatically placed together when you generate.</li>
                </ul>
              </section>

              <section style={{ marginBottom: "20px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginBottom: "10px" }}>
                  📅 Timetable Tab
                </h3>
                <p style={{ margin: "0 0 8px 0" }}>
                  Generate and manage timetables:
                </p>
                <ul style={{ margin: "8px 0 0 20px", paddingLeft: 0 }}>
                  <li><strong>Generate All Timetables (🔴):</strong> Auto-creates schedules for all classes at once</li>
                  <li><strong>Check Conflicts (🔵):</strong> Detects teachers assigned to multiple classes at the same time</li>
                  <li><strong>Edit Cells (✏️):</strong> Toggle edit mode and click any cell to change teacher/subject or add elective groups</li>
                  <li><strong>Download PDF:</strong> Export any class timetable as a printable PDF</li>
                  <li><strong>Export All Data (📥):</strong> Download an Excel file with all teachers, classes, timetables, and accounts</li>
                </ul>
              </section>

              <section style={{ marginBottom: "20px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginBottom: "10px" }}>
                  🚪 Teacher Leave Tab (Absences)
                </h3>
                <p style={{ margin: "0 0 8px 0" }}>
                  Manage teacher absences manually:
                </p>
                <ul style={{ margin: "8px 0 0 20px", paddingLeft: 0 }}>
                  <li>Select a teacher and a day to mark them absent</li>
                  <li>Absences are highlighted in the timetable</li>
                  <li>Delete absences when resolved</li>
                </ul>
              </section>

              <section style={{ marginBottom: "20px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginBottom: "10px" }}>
                  📩 Leave Requests Tab (Admin)
                </h3>
                <p style={{ margin: "0 0 8px 0" }}>
                  Review and handle leave requests submitted by teachers:
                </p>
                <ul style={{ margin: "8px 0 0 20px", paddingLeft: 0 }}>
                  <li>View pending/approved/rejected requests</li>
                  <li><strong>Approve</strong> — automatically creates an absence record for that teacher and day</li>
                  <li><strong>Reject</strong> — denies the request without creating an absence</li>
                </ul>
              </section>

              <section style={{ marginBottom: "20px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginBottom: "10px" }}>
                  🔐 Accounts Tab (Admin)
                </h3>
                <p style={{ margin: "0 0 8px 0" }}>
                  Create and manage user accounts:
                </p>
                <ul style={{ margin: "8px 0 0 20px", paddingLeft: 0 }}>
                  <li>Create <strong>Admin</strong> or <strong>Teacher</strong> accounts</li>
                  <li>Teacher accounts need a name + subject (auto-creates a teacher record)</li>
                  <li>Deleting a user removes all their associated data</li>
                  <li>Only admins can access this tab</li>
                </ul>
              </section>

              <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "24px 0" }} />

              {/* TEACHER SECTIONS */}
              <section style={{ marginBottom: "20px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginBottom: "10px" }}>
                  🗓️ My Timetable (Teachers)
                </h3>
                <p style={{ margin: "0 0 8px 0" }}>
                  View your personal weekly schedule across all classes:
                </p>
                <ul style={{ margin: "8px 0 0 20px", paddingLeft: 0 }}>
                  <li>Shows which class and subject you teach in each period</li>
                  <li>Empty slots (—) mean you're free that period</li>
                  <li>Data is pulled automatically from all class timetables</li>
                </ul>
              </section>

              <section style={{ marginBottom: "20px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginBottom: "10px" }}>
                  📋 My Requests (Teachers)
                </h3>
                <p style={{ margin: "0 0 8px 0" }}>
                  Submit and track leave requests:
                </p>
                <ul style={{ margin: "8px 0 0 20px", paddingLeft: 0 }}>
                  <li>Select a day and write a reason, then submit</li>
                  <li>Status shows: Pending, Approved, or Rejected</li>
                  <li>Admin reviews requests in the Leave Requests tab</li>
                </ul>
              </section>

              <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "24px 0" }} />

              {/* TIPS */}
              <section style={{ marginBottom: "16px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginBottom: "10px" }}>
                  ⚡ Quick Tips
                </h3>
                <ul style={{ margin: "0 0 0 20px", paddingLeft: 0 }}>
                  <li>📊 Always <strong>Check Conflicts</strong> after generating before finalizing</li>
                  <li>🔄 Teachers won't teach the same class back-to-back</li>
                  <li>⏰ Each teacher teaches max 4 periods per day</li>
                  <li>❌ Skip quota to auto-distribute teachers evenly</li>
                  <li>👥 Use <strong>Teacher Groups</strong> for elective subjects — grouped teachers always share the same period slot</li>
                  <li>🌙 Toggle dark mode with the ☀️/🌙 button in the header</li>
                </ul>
              </section>

              <section style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "14px", marginTop: "20px" }}>
                <p style={{ margin: 0, color: "#0f766e", fontSize: "14px", fontWeight: "600" }}>
                  💡 <strong>Recommended Workflow:</strong> Create teachers → Add classes → Assign teachers to classes → Generate timetable → Check conflicts → Done!
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
