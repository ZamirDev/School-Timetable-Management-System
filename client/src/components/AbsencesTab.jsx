import FieldError from "./ui/FieldError";
import { cardStyle, buttonPrimary, inputStyle } from "../utils/styles";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AbsencesTab({
  absences,
  teachers,
  absenceTeacher,
  setAbsenceTeacher,
  absenceDay,
  setAbsenceDay,
  saveAbsence,
  deleteAbsence,
  errors = {},
  setErrors,
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

      {/* MARK ABSENCE */}
      {isAdmin && (
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 20px 0", fontSize: "22px", fontWeight: "700", color: "var(--text-primary)" }}>
          Teacher Leave
        </h2>
        <form
          onSubmit={saveAbsence}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "12px", alignItems: "flex-end" }}
        >
          <div>
            <label style={{ fontSize: "14px", color: "var(--text-tertiary)", fontWeight: "600", display: "block", marginBottom: "6px" }}>
              Teacher
            </label>
            <select
              value={absenceTeacher}
              onChange={e => {
                setAbsenceTeacher(e.target.value);
                setErrors?.({});
              }}
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box", cursor: "pointer" }}
            >
              <option value="">Select a teacher...</option>
              {teachers.map(t => (
                <option key={t._id} value={t._id}>{t.name} ({t.subject})</option>
              ))}
            </select>
            <FieldError message={errors.teacher} />
          </div>
          <div>
            <label style={{ fontSize: "14px", color: "var(--text-tertiary)", fontWeight: "600", display: "block", marginBottom: "6px" }}>
              Day
            </label>
            <select
              value={absenceDay}
              onChange={e => {
                setAbsenceDay(e.target.value);
                setErrors?.({});
              }}
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box", cursor: "pointer" }}
            >
              {DAYS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <FieldError message={errors.day} />
          </div>
          <button
            type="submit"
            style={{
              ...buttonPrimary,
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)"
            }}
            onMouseEnter={e => e.target.style.transform = "translateY(-2px)"}
            onMouseLeave={e => e.target.style.transform = "translateY(0)"}
          >
            Save Leave
          </button>
        </form>
      </div>
      )}

      {/* ABSENCES LIST */}
      {absences.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", color: "var(--text-secondary)" }}>
          No absences recorded.
        </div>
      ) : (
        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "20px", fontWeight: "700", color: "var(--text-primary)" }}>
            Recorded Absences ({absences.length})
          </h3>
          <div style={{ borderRadius: "8px", border: "1px solid #cbd5e1", overflow: "hidden" }}>
            <table style={{ width: "100%", fontSize: "15px", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)", borderBottom: "2px solid #fecaca" }}>
                  <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: "700", color: "#991b1b" }}>👤 Teacher</th>
                  <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: "700", color: "#991b1b" }}>📖 Subject</th>
                  <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: "700", color: "#991b1b" }}>📅 Day</th>
                  {isAdmin && <th style={{ padding: "14px 16px", textAlign: "right", fontWeight: "700", color: "#991b1b" }}>⚙️ Actions</th>}
                </tr>
              </thead>
              <tbody>
                {absences.map((a, idx) => (
                  <tr
                    key={a._id}
                    style={{
                      background: idx % 2 === 0 ? "#f8fafc" : "white",
                      borderBottom: "1px solid #e2e8f0",
                      transition: "background 0.2s ease"
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "#f8fafc" : "white"}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <strong style={{ color: "var(--text-primary)", fontSize: "16px" }}>{a.teacher?.name || "Unknown"}</strong>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{
                        display: "inline-block",
                        background: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
                        color: "#991b1b",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "14px",
                        fontWeight: "600"
                      }}>
                        {a.teacher?.subject || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{
                        display: "inline-block",
                        background: "#fff7ed",
                        color: "#9a3412",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "14px",
                        fontWeight: "600"
                      }}>
                        {a.day}
                      </span>
                    </td>
                    {isAdmin && (
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      <button
                        onClick={() => deleteAbsence(a._id)}
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
                        Remove
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
