import { useState, useEffect } from "react";
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
  saveTeacherGroups,
  saveClassTeacher,
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

  const [localGroups, setLocalGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupTids, setNewGroupTids] = useState([]);
  const [savingGroups, setSavingGroups] = useState(false);
  const [selectedClassTeacher, setSelectedClassTeacher] = useState(classItem.classTeacher?._id || "");
  const [savingClassTeacher, setSavingClassTeacher] = useState(false);

  useEffect(() => {
    const raw = classItem.teacherGroups;
    if (raw && Array.isArray(raw) && raw.length > 0) {
      setLocalGroups(raw.map(g => ({
        groupName: g.groupName || "",
        teacherIds: (g.teachers || []).map(t => String(t._id ?? t)),
      })));
    } else {
      setLocalGroups([]);
    }
  }, [classItem._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSelectedClassTeacher(classItem.classTeacher?._id || "");
  }, [classItem._id, classItem.classTeacher]);

  const handleSaveClassTeacher = async () => {
    setSavingClassTeacher(true);
    await saveClassTeacher(classItem._id, selectedClassTeacher || null);
    setSavingClassTeacher(false);
  };

  const handleAddGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    if (newGroupTids.length < 2) return;
    if (localGroups.some(g => g.groupName === name)) return;
    setLocalGroups([...localGroups, { groupName: name, teacherIds: newGroupTids }]);
    setNewGroupName("");
    setNewGroupTids([]);
  };

  const handleRemoveGroup = (idx) => {
    setLocalGroups(localGroups.filter((_, i) => i !== idx));
  };

  const handleSaveGroups = async () => {
    setSavingGroups(true);
    await saveTeacherGroups(classItem._id, localGroups);
    setSavingGroups(false);
  };

  const toggleGroupTeacher = (tid) => {
    setNewGroupTids(prev =>
      prev.includes(tid) ? prev.filter(id => id !== tid) : [...prev, tid]
    );
  };

  return (
    <div style={{ background: "linear-gradient(135deg, #f8fafc 0%, #f0f9ff 100%)", border: "1px solid #cbd5e1", borderRadius: "10px", padding: "16px", marginTop: "16px" }}>
      
      {/* A. CLASS TEACHER */}
      <div style={{ marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid #e2e8f0" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "15px", color: "var(--text-primary)" }}>
          Class Teacher
        </label>
        <p style={{ margin: "0 0 10px 0", fontSize: "13px", color: "var(--text-secondary)" }}>
          The primary teacher responsible for this class. Each teacher can only be class teacher of one class.
        </p>
        {classItem.classTeacher && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
            background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
            border: "1px solid #bbf7d0",
            borderRadius: "8px",
            marginBottom: "10px",
            fontSize: "14px"
          }}>
            <span style={{ color: "#0f766e", fontWeight: 700 }}>Current:</span>
            <span style={{ color: "#0f766e" }}>{classItem.classTeacher.name} ({classItem.classTeacher.subject})</span>
          </div>
        )}
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
          <select
            value={selectedClassTeacher}
            onChange={e => setSelectedClassTeacher(e.target.value)}
            style={{ ...inputStyle, flex: 1, cursor: "pointer", fontSize: "14px", padding: "6px" }}
          >
            <option value="">— No class teacher —</option>
            {classItem.teachers.map(t => (
              <option key={t._id} value={t._id}>{t.name} ({t.subject})</option>
            ))}
          </select>
          <button
            onClick={handleSaveClassTeacher}
            disabled={savingClassTeacher || selectedClassTeacher === (classItem.classTeacher?._id || "")}
            style={{
              ...buttonPrimary,
              padding: "6px 14px",
              fontSize: "14px",
              opacity: (savingClassTeacher || selectedClassTeacher === (classItem.classTeacher?._id || "")) ? 0.5 : 1,
              cursor: (savingClassTeacher || selectedClassTeacher === (classItem.classTeacher?._id || "")) ? "not-allowed" : "pointer",
            }}
          >
            {savingClassTeacher ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* B. PERIODS PER DAY */}
      <div style={{ marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid #e2e8f0" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "15px", color: "var(--text-primary)" }}>
          Periods Per Day
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

      {/* C. ASSIGN TEACHERS */}
      <div style={{ marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid #e2e8f0" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "15px", color: "var(--text-primary)" }}>
          Assign Teachers
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

      {/* D. TEACHER GROUPS */}
      <div style={{ marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid #e2e8f0" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", fontSize: "15px", color: "var(--text-primary)" }}>
          Teacher Groups
        </label>
        <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "var(--text-secondary)" }}>
          Group teachers who share the same period slot (e.g. elective subjects). Grouped teachers will always appear together in the timetable.
        </p>

        {/* Existing groups */}
        {localGroups.length > 0 && (
          <div style={{ marginBottom: "12px" }}>
            {localGroups.map((g, idx) => (
              <div key={idx} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 10px",
                borderRadius: "6px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                marginBottom: "6px",
                fontSize: "14px",
              }}>
                <div>
                  <strong style={{ color: "var(--text-primary)" }}>{g.groupName}</strong>
                  <span style={{ color: "var(--text-secondary)", fontSize: "13px", marginLeft: "8px" }}>
                    — {g.teacherIds.map(tid => {
                      const t = classItem.teachers.find(ct => String(ct._id) === tid);
                      return t ? t.name : "?";
                    }).join(", ")}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveGroup(idx)}
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
              </div>
            ))}
          </div>
        )}

        {/* Add new group form */}
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #cbd5e1", padding: "12px" }}>
          <div style={{ marginBottom: "10px" }}>
            <input
              type="text"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              placeholder="Group name (e.g. Elective, Split)"
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box", fontSize: "14px", padding: "8px" }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label style={{ fontSize: "13px", color: "#475569", display: "block", marginBottom: "6px", fontWeight: "600" }}>
              Select teachers (min 2):
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {classItem.teachers.map(t => {
                const tid = String(t._id);
                const isSelected = newGroupTids.includes(tid);
                const isAlreadyGrouped = localGroups.some(g => g.teacherIds.includes(tid));
                return (
                  <label
                    key={tid}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: `1px solid ${isSelected ? "#3b82f6" : "#e2e8f0"}`,
                      background: isSelected ? "#eff6ff" : "#f8fafc",
                      cursor: isAlreadyGrouped ? "not-allowed" : "pointer",
                      fontSize: "13px",
                      opacity: isAlreadyGrouped ? 0.5 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isAlreadyGrouped}
                      onChange={() => toggleGroupTeacher(tid)}
                      style={{ accentColor: "#3b82f6" }}
                    />
                    {t.name} ({t.subject})
                  </label>
                );
              })}
            </div>
          </div>
          <button
            onClick={handleAddGroup}
            disabled={!newGroupName.trim() || newGroupTids.length < 2}
            style={{
              ...buttonSecondary,
              padding: "6px 14px",
              fontSize: "13px",
              opacity: (!newGroupName.trim() || newGroupTids.length < 2) ? 0.5 : 1,
            }}
          >
            + Add Group
          </button>
        </div>

        <button
          onClick={handleSaveGroups}
          disabled={savingGroups}
          style={{ ...buttonPrimary, marginTop: "12px", padding: "8px 16px", fontSize: "14px" }}
        >
          {savingGroups ? "Saving..." : "Save Groups"}
        </button>
      </div>

      {/* E. TEACHER QUOTA */}
      {classItem.teachers.length > 0 && (
        <div>
          <label style={{ display: "block", marginBottom: "10px", fontWeight: "700", fontSize: "15px", color: "var(--text-primary)" }}>
            Teacher Quota
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
                            {saved}
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
