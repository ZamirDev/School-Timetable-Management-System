import FieldError from "./ui/FieldError";
import { cardStyle, buttonPrimary, buttonSecondary, inputStyle, withValidation } from "../utils/styles";

export default function TeacherTabs({
  teachers,
  tName,
  setTName,
  tSubject,
  setTSubject,
  editId,
  setEditId,
  submitTeacher,
  deleteTeacher,
  errors = {},
  setErrors,
  validateTeacherField,
  role
}) {
  const isAdmin = role === "admin";
  return (
    <div>
      {!isAdmin && (
        <p style={{ margin: "0 0 12px 0", fontSize: "15px", color: "var(--text-secondary)", fontStyle: "italic" }}>
          👁️ View-only mode. Contact an admin to make changes.
        </p>
      )}

      {/* ADD TEACHER */}
      {isAdmin && (
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 20px 0", fontSize: "22px", fontWeight: "700", color: "var(--text-primary)" }}>➕ Add New Teacher</h2>
        <form
          onSubmit={submitTeacher}
          className="form-grid-3"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "12px", alignItems: "flex-end" }}
        >
          <div>
            <label style={{ fontSize: "14px", color: "var(--text-tertiary)", fontWeight: "600", display: "block", marginBottom: "6px" }}>
              Name
            </label>
            <input
              placeholder="Teacher name"
              value={tName}
              onChange={e => setTName(e.target.value)}
              onBlur={() => validateTeacherField?.("name")}
              style={withValidation(inputStyle, errors.name)}
            />
            <FieldError message={errors.name} />
          </div>
          <div>
            <label style={{ fontSize: "14px", color: "var(--text-tertiary)", fontWeight: "600", display: "block", marginBottom: "6px" }}>
              Subject
            </label>
            <input
              placeholder="Subject (e.g. Math)"
              value={tSubject}
              onChange={e => setTSubject(e.target.value)}
              onBlur={() => validateTeacherField?.("subject")}
              style={withValidation(inputStyle, errors.subject)}
            />
            <FieldError message={errors.subject} />
          </div>
          <button
            type="submit"
            style={buttonPrimary}
            onMouseEnter={e => e.target.style.transform = "translateY(-2px)"}
            onMouseLeave={e => e.target.style.transform = "translateY(0)"}
          >
            {editId ? "✅ Update" : "➕ Add"}
          </button>
          {editId && (
            <button
              type="button"
              onClick={() => {
                setEditId(null);
                setTName("");
                setTSubject("");
                setErrors?.({});
              }}
              style={{
                ...buttonSecondary,
                gridColumn: "1 / -1",
                background: "#fef2f2",
                borderColor: "#fecaca",
                color: "var(--text-error)"
              }}
            >
              ✕ Cancel Edit
            </button>
          )}
        </form>
      </div>
      )}

      {/* TEACHER LIST */}
      {teachers.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", color: "var(--text-secondary)" }}>
          No teachers yet. Add one above.
        </div>
      ) : (
        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "20px", fontWeight: "700", color: "var(--text-primary)" }}>
            👨‍🏫 Teachers Directory ({teachers.length})
          </h3>
          <div style={{ borderRadius: "8px", border: "1px solid #cbd5e1", overflow: "hidden" }}>
            <table style={{ width: "100%", fontSize: "15px", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)", borderBottom: "2px solid #cbd5e1" }}>
                  <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: "700", color: "#0c4a6e" }}>👤 Name</th>
                  <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: "700", color: "#0c4a6e" }}>📖 Subject</th>
                  {isAdmin && <th style={{ padding: "14px 16px", textAlign: "right", fontWeight: "700", color: "#0c4a6e" }}>⚙️ Actions</th>}
                </tr>
              </thead>
              <tbody>
                {teachers.map((t, idx) => (
                  <tr
                    key={t._id}
                    style={{
                      background: idx % 2 === 0 ? "#f8fafc" : "white",
                      borderBottom: "1px solid #e2e8f0",
                      transition: "background 0.2s ease"
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "#f8fafc" : "white"}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <strong style={{ color: "var(--text-primary)", fontSize: "16px" }}>{t.name}</strong>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{
                        display: "inline-block",
                        background: "linear-gradient(135deg, #e0e7ff 0%, #dbeafe 100%)",
                        color: "#1e40af",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "14px",
                        fontWeight: "600"
                      }}>
                        {t.subject}
                      </span>
                    </td>
                    {isAdmin && (
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      <button
                        onClick={() => {
                          setTName(t.name);
                          setTSubject(t.subject);
                          setEditId(t._id);
                        }}
                        style={{
                          background: "#f0fdf4",
                          color: "var(--text-success)",
                          border: "1px solid #bbf7d0",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          fontSize: "14px",
                          cursor: "pointer",
                          fontWeight: "600",
                          marginRight: "6px",
                          transition: "all 0.2s ease"
                        }}
                        onMouseEnter={e => e.target.style.background = "#dcfce7"}
                        onMouseLeave={e => e.target.style.background = "#f0fdf4"}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => deleteTeacher(t._id)}
                        style={{
                          background: "#fef2f2",
                          color: "var(--text-error)",
                          border: "1px solid #fecaca",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          fontSize: "14px",
                          cursor: "pointer",
                          fontWeight: "600",
                          transition: "all 0.2s ease"
                        }}
                        onMouseEnter={e => e.target.style.background = "#fee2e2"}
                        onMouseLeave={e => e.target.style.background = "#fef2f2"}
                      >
                        🗑️ Delete
                      </button>
                    </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
