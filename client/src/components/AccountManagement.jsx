import { useState, useEffect } from "react";
import { cardStyle, buttonPrimary } from "../utils/styles";
import { apiFetch } from "../utils/api";
import BulkImport from "./BulkImport";

export default function AccountManagement() {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("teacher");
  const [schoolName, setSchoolName] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [classRef, setClassRef] = useState("");
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  const fetchUsers = async () => {
    const res = await apiFetch("/auth/users");
    if (res.ok) setUsers(await res.json());
  };

  const fetchClasses = async () => {
    const res = await apiFetch("/classes");
    if (res.ok) setClasses(await res.json());
  };

  useEffect(() => { fetchUsers(); }, []);
  useEffect(() => { setClassRef(""); if (role === "student") fetchClasses(); }, [role]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Email and password required"); return; }
    if (role === "teacher" && (!name || !subject)) { setError("Teacher name and subject are required"); return; }
    if (role === "student" && !classRef) { setError("Class selection is required"); return; }
    setBusy(true);
    try {
      const body = { email, password, role, schoolName };
      if (role === "teacher") { body.name = name.trim(); body.subject = subject.trim(); }
      if (role === "student") { body.classRef = classRef; }
      const res = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create user"); return; }
      setEmail(""); setPassword(""); setSchoolName(""); setRole("teacher");
      setName(""); setSubject(""); setClassRef("");
      await fetchUsers();
    } catch {
      setError("Failed to create user");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (userId, userEmail) => {
    if (!window.confirm(`Delete user "${userEmail}" and all their data?`)) return;
    const res = await apiFetch(`/auth/users/${userId}`, { method: "DELETE" });
    if (res.ok) {
      await fetchUsers();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to delete user");
    }
  };

  return (
    <div>
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 20px 0", fontSize: "22px", fontWeight: "700", color: "var(--text-primary)" }}>
          Create New User
        </h2>

        {error && (
          <div style={{
            background: "#fef2f2",
            color: "#dc2626",
            padding: "10px 14px",
            borderRadius: "8px",
            fontSize: "15px",
            marginBottom: "16px",
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border, #e2e8f0)",
                fontSize: "16px",
                outline: "none",
                boxSizing: "border-box",
                background: "var(--bg-input, white)",
                color: "var(--text-primary, #0f172a)",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border, #e2e8f0)",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
                background: "var(--bg-input, white)",
                color: "var(--text-primary, #0f172a)",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
              Role
            </label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border, #e2e8f0)",
                fontSize: "16px",
                outline: "none",
                boxSizing: "border-box",
                background: "var(--bg-input, white)",
                color: "var(--text-primary, #0f172a)",
              }}
            >
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
              <option value="student">Student</option>
            </select>
          </div>
          {role === "student" && (
            <div>
              <label style={{ display: "block", fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                📚 Assign Class
              </label>
              <select
                value={classRef}
                onChange={e => setClassRef(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border, #e2e8f0)",
                  fontSize: "16px",
                  outline: "none",
                  boxSizing: "border-box",
                  background: "var(--bg-input, white)",
                  color: "var(--text-primary, #0f172a)",
                }}
              >
                <option value="">Select a class...</option>
                {classes.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          {role === "teacher" && (
            <>
              <div>
                <label style={{ display: "block", fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                  Teacher Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border, #e2e8f0)",
                    fontSize: "16px",
                    outline: "none",
                    boxSizing: "border-box",
                    background: "var(--bg-input, white)",
                    color: "var(--text-primary, #0f172a)",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border, #e2e8f0)",
                    fontSize: "16px",
                    outline: "none",
                    boxSizing: "border-box",
                    background: "var(--bg-input, white)",
                    color: "var(--text-primary, #0f172a)",
                  }}
                />
              </div>
            </>
          )}
          <div>
            <label style={{ display: "block", fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
              School Name (optional)
            </label>
            <input
              type="text"
              value={schoolName}
              onChange={e => setSchoolName(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border, #e2e8f0)",
                fontSize: "16px",
                outline: "none",
                boxSizing: "border-box",
                background: "var(--bg-input, white)",
                color: "var(--text-primary, #0f172a)",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            style={{
              ...buttonPrimary,
              alignSelf: "flex-start",
              background: busy ? "#94a3b8" : "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Creating..." : "Create User"}
          </button>
        </form>
      </div>

      {/* BULK IMPORT TOGGLE */}
      <button
        onClick={() => setShowBulkImport(!showBulkImport)}
        style={{
          ...buttonPrimary,
          width: "100%",
          background: showBulkImport ? "#475569" : "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          padding: "12px",
          fontSize: "15px",
          marginBottom: showBulkImport ? "0" : "24px",
          justifyContent: "center",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        📦 {showBulkImport ? "Close Bulk Import" : "Bulk Import from Spreadsheet"}
      </button>

      {showBulkImport && <BulkImport classes={classes} />}

      {/* TEACHERS SECTION */}
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 20px 0", fontSize: "22px", fontWeight: "700", color: "var(--text-primary)" }}>
          👨‍🏫 Teachers ({users.filter(u => u.role === "teacher").length})
        </h2>

        {users.filter(u => u.role === "teacher").length === 0 ? (
          <p style={{ color: "var(--text-secondary)", fontSize: "16px" }}>No teacher accounts yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "15px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border, #e2e8f0)" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>👤 Email</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>📛 Name</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>📖 Subject</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>🏫 School</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>📅 Created</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>⚙️ Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => u.role === "teacher").map(u => (
                  <tr key={u._id} style={{ borderBottom: "1px solid var(--border, #e2e8f0)" }}>
                    <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontWeight: 600 }}>{u.email}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-primary)" }}>
                      <strong>{u.teacherRef ? u.teacherRef.name : u.schoolName || "—"}</strong>
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                      {u.teacherRef ? u.teacherRef.subject : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{u.schoolName || "—"}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <button
                        onClick={() => handleDelete(u._id, u.email)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ef4444",
                          cursor: "pointer",
                          fontSize: "20px",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          lineHeight: 1,
                        }}
                        onMouseEnter={e => e.target.style.background = "#fef2f2"}
                        onMouseLeave={e => e.target.style.background = "none"}
                        title="Delete user and all their data"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* STUDENTS SECTION */}
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 20px 0", fontSize: "22px", fontWeight: "700", color: "var(--text-primary)" }}>
          🎒 Students ({users.filter(u => u.role === "student").length})
        </h2>

        {users.filter(u => u.role === "student").length === 0 ? (
          <p style={{ color: "var(--text-secondary)", fontSize: "16px" }}>No student accounts yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "15px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border, #e2e8f0)" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>👤 Email</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>📛 Name</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>📚 Class</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>📅 Created</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>⚙️ Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => u.role === "student").map(u => (
                  <tr key={u._id} style={{ borderBottom: "1px solid var(--border, #e2e8f0)" }}>
                    <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontWeight: 600 }}>{u.email}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-primary)" }}>
                      <strong>{u.schoolName || "—"}</strong>
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                      {u.classRef ? u.classRef.name : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <button
                        onClick={() => handleDelete(u._id, u.email)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ef4444",
                          cursor: "pointer",
                          fontSize: "20px",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          lineHeight: 1,
                        }}
                        onMouseEnter={e => e.target.style.background = "#fef2f2"}
                        onMouseLeave={e => e.target.style.background = "none"}
                        title="Delete user and all their data"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
