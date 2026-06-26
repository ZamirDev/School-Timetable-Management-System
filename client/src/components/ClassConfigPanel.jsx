import FieldError from "./ui/FieldError";
import { buttonPrimary, buttonSecondary, inputStyle, withValidation } from "../utils/styles";

export default function ClassConfigPanel({
  classItem,
  teachers,
  ppd,
  setPpd,
  schoolTiming,
  updateSchoolTiming,
  quotaInputs,
  selTeacher,
  setSelTeacher,
  handleQuotaChange,
  assignTeacher,
  removeTeacher,
  saveQuota,
  clearTeacherQuota,
  savePpd,
  saveSchoolTiming,
  fetchClasses,
  errors = {},
  validatePpdField,
  validateSchoolTimingField,
  validateQuotaField,
  validateAssignmentField
}) {
  const quotaErrors = errors.quota || {};

  return (
    <div style={{ background: "linear-gradient(135deg, #f8fafc 0%, #f0f9ff 100%)", border: "1px solid #cbd5e1", borderRadius: "10px", padding: "16px", marginTop: "16px" }}>
      
      {/* A. PERIODS PER DAY */}
      <div style={{ marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid #e2e8f0" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "15px", color: "var(--text-primary)" }}>
          📚 Periods Per Day
        </label>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            type="number"
            min="1"
            max="12"
            value={ppd[classItem._id] ?? "6"}
            onChange={e => setPpd(prev => ({ ...prev, [classItem._id]: e.target.value }))}
            onBlur={() => validatePpdField?.(classItem._id)}
            style={withValidation({ ...inputStyle, width: "70px", textAlign: "center", fontSize: "14px", padding: "6px" }, errors.periodsPerDay)}
          />
          <button onClick={() => savePpd(classItem._id)} style={{ ...buttonSecondary, padding: "6px 14px", fontSize: "14px" }}>
            Save
          </button>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            {(classItem.periodsPerDay || 6) * 6} slots/week
          </span>
          <FieldError message={errors.periodsPerDay} />
        </div>
      </div>

      {/* B. ASSIGN TEACHERS */}
      <div style={{ marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid #e2e8f0" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "15px", color: "var(--text-primary)" }}>
          👨‍🏫 Assign Teachers
        </label>
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <select
            value={selTeacher[classItem._id] || ""}
            onChange={e => setSelTeacher({ ...selTeacher, [classItem._id]: e.target.value })}
            onBlur={() => validateAssignmentField?.(classItem._id)}
            style={withValidation({ ...inputStyle, flex: 1, cursor: "pointer", fontSize: "14px", padding: "6px" }, errors.assignment)}
          >
            <option value="">Select teacher...</option>
            {teachers
              .filter(t => !classItem.teachers.find(ct => ct._id === t._id))
              .map(t => (
                <option key={t._id} value={t._id}>
                  {t.name} ({t.subject})
                </option>
              ))}
          </select>
          <button
            onClick={() => assignTeacher(classItem._id, selTeacher[classItem._id])}
            style={{ ...buttonPrimary, padding: "6px 14px", fontSize: "14px" }}
          >
            Add
          </button>
        </div>
        <FieldError message={errors.assignment} />

        {classItem.teachers.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: "0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px" }}>
            {classItem.teachers.map((t) => (
              <li
                key={t._id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px",
                  borderRadius: "6px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  fontSize: "14px"
                }}
              >
                <div>
                  <strong style={{ color: "var(--text-primary)", fontSize: "15px" }}>{t.name}</strong> <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>({t.subject})</span>
                </div>
                <button
                  onClick={() => removeTeacher(classItem._id, t._id)}
                  style={{
                    background: "#ffecec",
                    color: "#dc2626",
                    border: "none",
                    padding: "4px 10px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* D. TEACHER QUOTA */}
      {classItem.teachers.length > 0 && (
        <div>
          <label style={{ display: "block", marginBottom: "10px", fontWeight: "700", fontSize: "15px", color: "var(--text-primary)" }}>
            📊 Teacher Quota
          </label>
          <div style={{ background: "white", borderRadius: "8px", border: "1px solid #cbd5e1", overflow: "hidden" }}>
            <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
              <tbody>
                {classItem.teachers.map((t, idx) => {
                  const tid = String(t._id);
                  const saved = (classItem.teacherQuota || {})[tid];
                  const inputVal = quotaInputs[classItem._id]?.[tid] ?? (saved !== undefined ? String(saved) : "");
                  const totalSlots = (classItem.periodsPerDay || 6) * 6;

                  return (
                    <tr key={tid} style={{ borderBottom: "1px solid #e2e8f0", background: idx % 2 === 0 ? "#f8fafc" : "white" }}>
                      <td style={{ padding: "8px 12px" }}>
                        <strong style={{ color: "var(--text-primary)", fontSize: "14px" }}>{t.name}</strong>
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <input
                          type="number"
                          min="0"
                          max={totalSlots}
                          placeholder="auto"
                          value={inputVal}
                          onChange={e => handleQuotaChange(classItem._id, tid, e.target.value)}
                          onBlur={() => validateQuotaField?.(classItem._id, tid)}
                          style={withValidation({ ...inputStyle, width: "70px", textAlign: "center", fontSize: "13px", padding: "4px" }, quotaErrors[tid])}
                        />
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        {saved !== undefined && (
                          <span style={{ fontSize: "12px", color: "#10b981", fontWeight: "700", background: "#ecfdf5", padding: "2px 6px", borderRadius: "4px" }}>
                            ✓ {saved}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            onClick={() => saveQuota(classItem._id)}
            style={{ ...buttonPrimary, marginTop: "12px", padding: "8px 16px", fontSize: "14px" }}
          >
            Save Quota
          </button>
          <FieldError message={errors.quotaForm} />
        </div>
      )}
    </div>
  );
}
