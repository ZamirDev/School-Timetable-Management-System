import ClassConfigPanel from "./ClassConfigPanel";
import FieldError from "./ui/FieldError";
import { cardStyle, buttonPrimary, buttonSecondary, inputStyle, withValidation } from "../utils/styles";

export default function ClassesTab({
  classes,
  className,
  setClassName,
  configuring,
  setConfiguring,
  teachers,
  ppd,
  setPpd,
  schoolTiming,
  updateSchoolTiming,
  quotaInputs,
  selTeacher,
  setSelTeacher,
  handleQuotaChange,
  addClass,
  deleteClass,
  assignTeacher,
  removeTeacher,
  saveQuota,
  clearTeacherQuota,
  savePpd,
  saveSchoolTiming,
  fetchClasses,
  classErrors = {},
  validateClassField,
  configErrors = {},
  validatePpdField,
  validateSchoolTimingField,
  validateQuotaField,
  validateAssignmentField,
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

      {/* ADD CLASS */}
      {isAdmin && (
      <div style={{ ...cardStyle, marginBottom: "16px", padding: "16px" }}>
        <h2 style={{ margin: "0 0 12px 0", fontSize: "20px", fontWeight: "700", color: "var(--text-primary)" }}>➕ Add New Class</h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <input
              placeholder="Class name (e.g. 10A)"
              value={className}
              onChange={e => setClassName(e.target.value)}
              onBlur={validateClassField}
              style={withValidation({ ...inputStyle, width: "100%", boxSizing: "border-box", fontSize: "14px", padding: "8px" }, classErrors.name)}
            />
            <FieldError message={classErrors.name} />
          </div>
          <button
            onClick={addClass}
            style={{ ...buttonPrimary, padding: "8px 16px", fontSize: "14px" }}
            onMouseEnter={e => e.target.style.transform = "translateY(-2px)"}
            onMouseLeave={e => e.target.style.transform = "translateY(0)"}
          >
            Add Class
          </button>
        </div>
      </div>
      )}

      {/* UNIFIED SCHOOL TIMING & BREAKS */}
      <div style={{ ...cardStyle, marginBottom: "16px", padding: "16px" }}>
        <h2 style={{ margin: "0 0 12px 0", fontSize: "20px", fontWeight: "700", color: "var(--text-primary)" }}>⏰ School Timing & Breaks (All Classes)</h2>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
          <div>
            <label style={{ fontSize: "13px", color: "#475569", display: "block", marginBottom: "4px", fontWeight: "600" }}>
              Start Time
            </label>
            <input
              type="time"
              value={schoolTiming?.startTime ?? "08:00"}
              onChange={e => updateSchoolTiming("startTime", e.target.value)}
              onBlur={() => validateSchoolTimingField?.("startTime")}
              style={withValidation({ ...inputStyle, fontSize: "14px", padding: "6px" }, (configErrors.schoolTiming || {}).startTime)}
            />
            <FieldError message={(configErrors.schoolTiming || {}).startTime} />
          </div>
          <div>
            <label style={{ fontSize: "13px", color: "#475569", display: "block", marginBottom: "4px", fontWeight: "600" }}>
              Period Duration (min)
            </label>
            <input
              type="number"
              min="10"
              max="120"
              value={schoolTiming?.periodDuration ?? 40}
              onChange={e => updateSchoolTiming("periodDuration", e.target.value)}
              onBlur={() => validateSchoolTimingField?.("periodDuration")}
              style={withValidation({ ...inputStyle, fontSize: "14px", padding: "6px" }, (configErrors.schoolTiming || {}).periodDuration)}
            />
            <FieldError message={(configErrors.schoolTiming || {}).periodDuration} />
          </div>
          <div>
            <label style={{ fontSize: "13px", color: "#475569", display: "block", marginBottom: "4px", fontWeight: "600" }}>
              Break After Period
            </label>
            <input
              type="number"
              min="1"
              max="12"
              value={schoolTiming?.breakAfter ?? 3}
              onChange={e => updateSchoolTiming("breakAfter", e.target.value)}
              onBlur={() => validateSchoolTimingField?.("breakAfter")}
              style={withValidation({ ...inputStyle, fontSize: "14px", padding: "6px" }, (configErrors.schoolTiming || {}).breakAfter)}
            />
            <FieldError message={(configErrors.schoolTiming || {}).breakAfter} />
          </div>
          <div>
            <label style={{ fontSize: "13px", color: "#475569", display: "block", marginBottom: "4px", fontWeight: "600" }}>
              Break Duration (min)
            </label>
            <input
              type="number"
              min="5"
              max="60"
              value={schoolTiming?.breakDuration ?? 20}
              onChange={e => updateSchoolTiming("breakDuration", e.target.value)}
              onBlur={() => validateSchoolTimingField?.("breakDuration")}
              style={withValidation({ ...inputStyle, fontSize: "14px", padding: "6px" }, (configErrors.schoolTiming || {}).breakDuration)}
            />
            <FieldError message={(configErrors.schoolTiming || {}).breakDuration} />
          </div>
        </div>

        {isAdmin && (
        <button 
          onClick={saveSchoolTiming}
          style={{ ...buttonPrimary, background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", padding: "8px 16px", fontSize: "14px" }}
        >
          💾 Save Timing for All Classes
        </button>
        )}
      </div>

      {/* CLASS LIST */}
      {classes.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", color: "var(--text-secondary)" }}>
          No classes yet. Add one above.
        </div>
      ) : (
        classes.map(c => (
          <div key={c._id} style={{ ...cardStyle, marginBottom: "12px", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div>
                <strong style={{ margin: "0 0 2px 0", fontSize: "18px", fontWeight: "700", color: "var(--text-primary)" }}>{c.name}</strong>
                <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "var(--text-secondary)" }}>
                  👨‍🏫 <strong style={{ color: "var(--text-primary)" }}>{c.teachers.length}</strong> teacher{c.teachers.length !== 1 ? "s" : ""} assigned
                </p>
              </div>
              {isAdmin && (
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => setConfiguring(configuring === c._id ? null : c._id)}
                  style={{
                    ...buttonSecondary,
                    padding: "6px 12px",
                    fontSize: "14px",
                    background: configuring === c._id ? "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" : "#f1f5f9",
                    color: configuring === c._id ? "white" : "var(--text-primary)",
                    border: configuring === c._id ? "none" : "1px solid #cbd5e1"
                  }}
                >
                  {configuring === c._id ? "✕ Close" : "⚙️ Configure"}
                </button>
                <button
                  onClick={() => deleteClass(c._id)}
                  style={{
                    ...buttonSecondary,
                    padding: "6px 12px",
                    fontSize: "14px",
                    color: "var(--text-error)",
                    borderColor: "#fecaca",
                    background: "#fef2f2"
                  }}
                >
                  Delete
                </button>
              </div>
              )}
            </div>

            {/* CONFIGURATION PANEL */}
            {configuring === c._id && (
              <ClassConfigPanel
                classItem={c}
                teachers={teachers}
                ppd={ppd}
                setPpd={setPpd}
                schoolTiming={schoolTiming}
                updateSchoolTiming={updateSchoolTiming}
                quotaInputs={quotaInputs}
                selTeacher={selTeacher}
                setSelTeacher={setSelTeacher}
                handleQuotaChange={handleQuotaChange}
                assignTeacher={assignTeacher}
                removeTeacher={removeTeacher}
                saveQuota={saveQuota}
                clearTeacherQuota={clearTeacherQuota}
                savePpd={savePpd}
                saveSchoolTiming={saveSchoolTiming}
                fetchClasses={fetchClasses}
                errors={configErrors[c._id] || {}}
                validatePpdField={validatePpdField}
                validateSchoolTimingField={validateSchoolTimingField}
                validateQuotaField={validateQuotaField}
                validateAssignmentField={validateAssignmentField}
              />
            )}
          </div>
        ))
      )}
    </div>
  );
}
