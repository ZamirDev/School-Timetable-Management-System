import { useState, useEffect, useRef } from "react";
import { cardStyle, buttonPrimary, buttonSecondary } from "../utils/styles";
import { apiFetch } from "../utils/api";
import * as XLSX from "xlsx";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export default function Timetable({ classes, selectedClass, setSelectedClass, generating, setGenerating, quotaSummary, setQuotaSummary, fetchClasses, conflicts, detectConflicts, conflictsChecked, setConflictsChecked, role, studentClassRef }) {
  const [editMode, setEditMode] = useState(false);
  const [editPopup, setEditPopup] = useState(null);
  const [editTeacher, setEditTeacher] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editTracks, setEditTracks] = useState([]);
  const [editMsg, setEditMsg] = useState(null);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState(null);

  // Progress bar
  const [genProgress, setGenProgress] = useState(null);
  const pollRef = useRef(null);

  const isAdmin = role === "admin";
  const isStudent = role === "student";

  const [studentClass, setStudentClass] = useState(null);
  const [loadingStudent, setLoadingStudent] = useState(false);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (isStudent && studentClassRef) {
      setLoadingStudent(true);
      apiFetch(`/classes/${studentClassRef}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          setStudentClass(data);
          setLoadingStudent(false);
        })
        .catch(() => setLoadingStudent(false));
    }
  }, [isStudent, studentClassRef]);

  const displayClasses = isStudent ? (studentClass ? [studentClass] : []) : classes;

  const openEditPopup = (classId, day, period) => {
    const cls = classes.find(c => c._id === classId);
    if (!cls || !cls.timetable) return;
    const dayData = cls.timetable.find(d => d.day === day);
    if (!dayData) return;
    const p = dayData.periods.find(pr => pr.period === period);
    const currentTeacher = p?.teacher?._id || p?.teacher || "";
    const currentSubject = p?.subject || "";
    setEditTeacher(currentTeacher);
    setEditSubject(currentSubject === "Free Period" ? "" : currentSubject);
    setEditTracks((p?.tracks || []).map(t => ({
      groupName: t.groupName || "",
      teacher: t.teacher?._id || t.teacher || "",
      subject: t.subject || "",
    })));
    setEditPopup({ classId, day, period });
  };

  const saveEditPeriod = async () => {
    if (!editPopup) return;
    const { classId, day, period } = editPopup;
    setEditMsg(null);
    try {
      const body = { day, period };
      body.teacherId = editTeacher || null;
      body.subject = editSubject.trim() || "Free Period";
      body.tracks = editTracks.filter(t => t.groupName.trim());
      const res = await apiFetch(`/classes/${classId}/edit-period`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setEditPopup(null);
        setEditMsg({ type: "success", text: `Updated Period ${period} (${day})` });
        fetchClasses();
      } else {
        setEditMsg({ type: "error", text: data.error || "Failed to update period" });
      }
    } catch {
      setEditMsg({ type: "error", text: "Failed to update period" });
    }
    setTimeout(() => setEditMsg(null), 3000);
  };

  const handleExport = async () => {
    try {
      const [teachersRes, classesRes, absencesRes, usersRes, syncsRes] = await Promise.all([
        apiFetch("/teachers"),
        apiFetch("/classes"),
        apiFetch("/absences"),
        apiFetch("/auth/users"),
        apiFetch("/group-syncs"),
      ]);

      const t = await teachersRes.json();
      const c = await classesRes.json();
      const a = await absencesRes.json();
      const u = await usersRes.json();
      const s = await syncsRes.json();

      const wb = XLSX.utils.book_new();

      // ── Teachers ──
      const teachersSheet = t.map(tr => ({ Name: tr.name, Subject: tr.subject }));
      const ws1 = XLSX.utils.json_to_sheet(teachersSheet);
      XLSX.utils.book_append_sheet(wb, ws1, "Teachers");

      // ── Classes ──
      const classesSheet = c.map(cl => ({
        "Class Name": cl.name,
        "Periods Per Day": cl.periodsPerDay,
        "Start Time": cl.schoolTiming?.startTime || "08:00",
        "Period Duration (min)": cl.schoolTiming?.periodDuration || 40,
        "Break After Period": cl.schoolTiming?.breakAfter || 3,
        "Break Duration (min)": cl.schoolTiming?.breakDuration || 20,
        "Teachers": (cl.teachers || []).map(t => t.name).join(", "),
      }));
      const ws2 = XLSX.utils.json_to_sheet(classesSheet);
      XLSX.utils.book_append_sheet(wb, ws2, "Classes");

      // ── Timetable ──
      const timetableSheet = [];
      for (const cl of c) {
        if (!cl.timetable) continue;
        for (const day of cl.timetable) {
          for (const p of day.periods) {
            // Main row
            timetableSheet.push({
              Class: cl.name,
              Day: day.day,
              Period: p.period,
              "Start Time": p.startTime,
              "End Time": p.endTime,
              Teacher: p.teacher?.name || "—",
              Subject: p.subject || "Free",
              "Group Name": "",
              "Track Teacher": "",
              "Track Subject": "",
            });
            // Track rows
            if (p.tracks && p.tracks.length > 0) {
              for (const tr of p.tracks) {
                timetableSheet.push({
                  Class: cl.name,
                  Day: day.day,
                  Period: p.period,
                  "Start Time": "",
                  "End Time": "",
                  Teacher: "",
                  Subject: "",
                  "Group Name": tr.groupName || "",
                  "Track Teacher": tr.teacher?.name || "—",
                  "Track Subject": tr.subject || "",
                });
              }
            }
          }
        }
      }
      const ws3 = XLSX.utils.json_to_sheet(timetableSheet);
      XLSX.utils.book_append_sheet(wb, ws3, "Timetable");

      // ── Accounts ──
      const usersSheet = u.map(usr => ({
        Email: usr.email,
        Role: usr.role,
        Name: usr.teacherRef?.name || usr.schoolName || "—",
        Subject: usr.teacherRef?.subject || "—",
        Class: usr.classRef?.name || "—",
        Password: btoa(usr.plainPassword || ""),
      }));
      const ws4 = XLSX.utils.json_to_sheet(usersSheet);
      XLSX.utils.book_append_sheet(wb, ws4, "Accounts");

      // ── Absences ──
      const absencesSheet = a.map(ab => ({
        Teacher: ab.teacher?.name || "—",
        Day: ab.day,
      }));
      const ws5 = XLSX.utils.json_to_sheet(absencesSheet);
      XLSX.utils.book_append_sheet(wb, ws5, "Absences");

      // ── Teacher Groups ──
      const teacherGroupsSheet = [];
      for (const cl of c) {
        if (!cl.teacherGroups || cl.teacherGroups.length === 0) continue;
        for (const g of cl.teacherGroups) {
          const tNames = (g.teachers || []).map(t => t.name || "—").join(", ");
          teacherGroupsSheet.push({
            Class: cl.name,
            "Group Name": g.groupName,
            Teachers: tNames,
          });
        }
      }
      const ws6 = XLSX.utils.json_to_sheet(teacherGroupsSheet);
      XLSX.utils.book_append_sheet(wb, ws6, "Teacher Groups");

      // ── Group Syncs ──
      const groupSyncsSheet = s.map(sync => ({
        "Group Name": sync.groupName || "",
        Classes: (sync.classIds || []).map(cls => cls.name || "—").join(", "),
      }));
      const ws7 = XLSX.utils.json_to_sheet(groupSyncsSheet);
      XLSX.utils.book_append_sheet(wb, ws7, "Group Syncs");

      const date = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `timetable-export-${date}.xlsx`);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export data. Check console for details.");
    }
  };

  const handleImportFile = async (file) => {
    setImportFile(file);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        const readSheet = (name) => {
          const sheet = workbook.Sheets[name];
          return sheet ? XLSX.utils.sheet_to_json(sheet) : [];
        };

        const rawTeachers = readSheet("Teachers");
        const rawClasses = readSheet("Classes");
        const rawTimetable = readSheet("Timetable");
        const rawAccounts = readSheet("Accounts");
        const rawAbsences = readSheet("Absences");
        const rawTeacherGroups = readSheet("Teacher Groups");
        const rawGroupSyncs = readSheet("Group Syncs");

        const payload = {
          teachers: rawTeachers.map(r => ({ name: r.Name || r.name, subject: r.Subject || r.subject })),
          classes: rawClasses.map(r => ({
            name: r["Class Name"] || r.className || r.name,
            periodsPerDay: r["Periods Per Day"] || r.periodsPerDay,
            startTime: r["Start Time"] || r.startTime,
            periodDuration: r["Period Duration (min)"] || r.periodDuration,
            breakAfter: r["Break After Period"] || r.breakAfter,
            breakDuration: r["Break Duration (min)"] || r.breakDuration,
            teacherNames: r.Teachers || r.teachers || "",
          })),
          timetable: rawTimetable.map(r => ({
            className: r.Class || r.className,
            day: r.Day || r.day,
            period: r.Period || r.period,
            startTime: r["Start Time"] || r.startTime,
            endTime: r["End Time"] || r.endTime,
            teacher: r.Teacher || r.teacher,
            subject: r.Subject || r.subject,
            groupName: r["Group Name"] || r.groupName,
            trackTeacher: r["Track Teacher"] || r.trackTeacher,
            trackSubject: r["Track Subject"] || r.trackSubject,
          })),
          accounts: rawAccounts.map(r => {
            const rawPw = r.Password || r.password || "";
            let password = rawPw;
            try { password = atob(rawPw); } catch {}
            return {
              email: r.Email || r.email,
              role: r.Role || r.role,
              name: r.Name || r.name,
              subject: r.Subject || r.subject,
              className: r.Class || r.className,
              password,
            };
          }),
          absences: rawAbsences.map(r => ({
            teacherName: r.Teacher || r.teacher,
            day: r.Day || r.day,
          })),
          teacherGroups: rawTeacherGroups.map(r => ({
            className: r.Class || r.className,
            groupName: r["Group Name"] || r.groupName,
            teachers: r.Teachers || r.teachers,
          })),
          groupSyncs: rawGroupSyncs.map(r => ({
            groupName: r["Group Name"] || r.groupName,
            classes: r.Classes || r.classes,
          })),
        };

        setImporting(true);
        const res = await apiFetch("/import", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const data2 = await res.json();
        setImporting(false);

        if (!res.ok) {
          setImportResult({ error: data2.error || "Import failed" });
        } else {
          setImportResult({ success: true, result: data2.result });
          fetchClasses();
        }
      } catch (err) {
        setImporting(false);
        setImportResult({ error: err.message || "Failed to parse file" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const pollProgress = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiFetch("/generate-progress");
        const data = await res.json();
        if (data.active) {
          setGenProgress(data);
        } else {
          setGenProgress(null);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch { /* ignore */ }
    }, 300);
  };

  const generateTimetable = async () => {
    setGenerating(true);
    setGenProgress({ current: 0, total: 6, stage: "Preparing..." });
    setQuotaSummary(null);
    setConflictsChecked(false);
    pollProgress();
    await apiFetch("/reset-timetable", { method: "POST" });
    const res = await apiFetch("/generate-timetable", { method: "POST" });
    const data = await res.json();
    if (data.quotaSummary) setQuotaSummary(data.quotaSummary);
    setGenerating(false);
    setGenProgress(null);
    if (pollRef.current) clearInterval(pollRef.current);
    fetchClasses();
  };

  if (isStudent && loadingStudent) {
    return (
      <div style={cardStyle}>
        <p style={{ color: "var(--text-secondary)", fontSize: "16px", textAlign: "center" }}>⏳ Loading your timetable...</p>
      </div>
    );
  }

  if (isStudent && !studentClassRef) {
    return (
      <div style={cardStyle}>
        <p style={{ color: "var(--text-secondary)", fontSize: "16px", textAlign: "center" }}>
          No class assigned to your account. Contact an admin.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 20px 0", fontSize: "22px", fontWeight: "700", color: "var(--text-primary)" }}>
          {isStudent ? "📋 My Class Timetable" : "Generate Timetables for All Classes"}
        </h2>

        {isStudent && (
          <p style={{ margin: "0 0 12px 0", fontSize: "15px", color: "var(--text-secondary)", fontStyle: "italic" }}>
            🎒 Student View — Your class timetable
          </p>
        )}
        {!isAdmin && !isStudent && (
          <p style={{ margin: "0 0 12px 0", fontSize: "15px", color: "var(--text-secondary)", fontStyle: "italic" }}>
            👁️ View-only mode. Contact an admin to make changes.
          </p>
        )}
        {!isStudent && (
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {isAdmin && (
              <button
                onClick={generateTimetable}
                disabled={generating || classes.length === 0}
                style={{
                  ...buttonPrimary,
                  background: generating ? "#94a3b8" : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                  cursor: generating || classes.length === 0 ? "not-allowed" : "pointer",
                  boxShadow: generating ? "none" : "0 4px 12px rgba(239, 68, 68, 0.3)"
                }}
              >
                {generating ? "⏳ Generating..." : "⚡ Generate All Timetables"}
              </button>
            )}

            <button
              onClick={detectConflicts}
              disabled={classes.length === 0}
              style={{
                ...buttonPrimary,
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                cursor: classes.length === 0 ? "not-allowed" : "pointer",
                boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)"
              }}
            >
              🔍 Check Conflicts
            </button>

            {isAdmin && (
              <button
                onClick={handleExport}
                disabled={classes.length === 0 && true}
                style={{
                  ...buttonPrimary,
                  background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(5, 150, 105, 0.3)"
                }}
              >
                📥 Export All Data
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => { setShowImport(!showImport); setImportResult(null); setImportFile(null); }}
                style={{
                  ...buttonPrimary,
                  background: showImport ? "#475569" : "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                  cursor: "pointer",
                  boxShadow: showImport ? "none" : "0 4px 12px rgba(139, 92, 246, 0.3)"
                }}
              >
                📥 {showImport ? "Close Import" : "Import Data"}
              </button>
            )}
          </div>
        )}

        {/* PROGRESS BAR */}
        {genProgress && (
          <div style={{ marginTop: "16px", padding: "16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>
              <span>{genProgress.stage}</span>
              <span>{Math.round((genProgress.current / genProgress.total) * 100)}%</span>
            </div>
            <div style={{ width: "100%", height: "10px", background: "#e2e8f0", borderRadius: "5px", overflow: "hidden" }}>
              <div style={{
                width: `${(genProgress.current / genProgress.total) * 100}%`,
                height: "100%",
                background: "linear-gradient(90deg, #3b82f6, #2563eb)",
                borderRadius: "5px",
                transition: "width 0.3s ease",
              }} />
            </div>
            <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "var(--text-secondary)", textAlign: "center" }}>
              {genProgress.current} of {genProgress.total} days completed
            </p>
          </div>
        )}

        {editMsg && (
          <div style={{
            marginTop: "12px",
            padding: "10px 14px",
            borderRadius: "8px",
            fontSize: "15px",
            fontWeight: "600",
            background: editMsg.type === "success" ? "#f0fdf4" : "#fef2f2",
            border: editMsg.type === "success" ? "1px solid #bbf7d0" : "1px solid #fecaca",
            color: editMsg.type === "success" ? "#0f766e" : "#dc2626",
          }}>
            {editMsg.type === "success" ? "✅ " : "⚠️ "}{editMsg.text}
          </div>
        )}

        {isAdmin && !isStudent && (
          <div style={{ marginTop: "12px", display: "flex", gap: "12px", alignItems: "center" }}>
            <button
              onClick={() => { setEditMode(!editMode); setEditPopup(null); }}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: editMode ? "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" : "#e2e8f0",
                color: editMode ? "white" : "var(--text-primary, #0f172a)",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ✏️ {editMode ? "Done Editing" : "Edit Cells"}
            </button>
            {editMode && (
              <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                Click a cell to edit its teacher and subject
              </span>
            )}
          </div>
        )}
      </div>

      {/* CONFLICT DETECTION RESULTS */}
      {!isStudent && conflictsChecked && conflicts.length === 0 && (
        <div style={{ ...cardStyle, background: "linear-gradient(135deg, #f0fdf4 0%, #e0fce8 100%)", border: "1px solid #bbf7d0" }}>
          <p style={{ color: "var(--text-success)", fontSize: "16px", margin: 0 }}>✅ No conflicts found. Timetable is valid.</p>
        </div>
      )}

      {!isStudent && conflicts.length > 0 && (
        <div style={{ ...cardStyle, background: "linear-gradient(135deg, #fef2f2 0%, #fde68a 100%)", border: "2px solid #fca5a5" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "700", color: "var(--text-break)" }}>⚠️ Conflicts Detected:</h3>
          <div style={{ display: "grid", gap: "12px" }}>
            {conflicts.map((c, idx) => (
              <div key={idx} style={{ padding: "12px", background: "white", borderRadius: "6px", border: "1px solid #fecaca" }}>
                <p style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: "700", color: "var(--text-error)" }}>
                  {c.day} - Period {c.period}
                </p>
                <p style={{ margin: "0 0 6px 0", fontSize: "14px", color: "var(--text-tertiary)", fontWeight: "600" }}>
                  {c.teacher} assigned to:
                </p>
                <div style={{ marginLeft: "12px" }}>
                  {c.classes.map((cls, i) => (
                    <p key={i} style={{ margin: "4px 0", fontSize: "14px", color: "var(--text-tertiary)" }}>• {cls}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IMPORT UI */}
      {showImport && (
        <div style={{ ...cardStyle, marginTop: "16px" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>
            📥 Import Data from Spreadsheet
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "var(--text-secondary)" }}>
            Upload an <strong>.xlsx</strong> file exported from this system to restore all data.
            This will create or update teachers, accounts, classes, timetables, groups, syncs, and absences.
          </p>

          {!importFile ? (
            <div
              onClick={() => document.getElementById("import-file-input").click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#8b5cf6"; e.currentTarget.style.background = "#f5f3ff"; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = "var(--border, #cbd5e1)"; e.currentTarget.style.background = "transparent"; }}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) handleImportFile(f); }}
              style={{
                border: "2px dashed var(--border, #cbd5e1)",
                borderRadius: "10px",
                padding: "40px 20px",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <p style={{ margin: "0 0 8px 0", fontSize: "28px" }}>📄</p>
              <p style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>
                Click or drag your exported .xlsx here
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>
                Requires 7 sheets: Teachers, Classes, Timetable, Accounts, Absences, Teacher Groups, Group Syncs
              </p>
              <input
                id="import-file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }}
                style={{ display: "none" }}
              />
            </div>
          ) : importing ? (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <p style={{ fontSize: "16px", color: "var(--text-secondary)", fontWeight: 600 }}>⏳ Importing data...</p>
            </div>
          ) : importResult ? (
            <div>
              {importResult.error ? (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "14px", marginBottom: "12px" }}>
                  <p style={{ margin: 0, color: "#dc2626", fontWeight: 600, fontSize: "15px" }}>❌ Import failed: {importResult.error}</p>
                  <button
                    onClick={() => { setImportFile(null); setImportResult(null); }}
                    style={{ marginTop: "12px", padding: "8px 16px", borderRadius: "8px", border: "none", background: "#0f172a", color: "white", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "16px", marginBottom: "12px" }}>
                    <p style={{ margin: "0 0 8px 0", color: "#0f766e", fontWeight: 700, fontSize: "16px" }}>✅ Import successful!</p>
                    {importResult.result && (
                      <div style={{ fontSize: "14px", color: "#0f766e" }}>
                        <p style={{ margin: "2px 0" }}>• {importResult.result.teachers} teachers</p>
                        <p style={{ margin: "2px 0" }}>• {importResult.result.accounts} accounts</p>
                        <p style={{ margin: "2px 0" }}>• {importResult.result.classes} classes</p>
                        <p style={{ margin: "2px 0" }}>• {importResult.result.periods} periods</p>
                        <p style={{ margin: "2px 0" }}>• {importResult.result.teacherGroups} teacher groups</p>
                        <p style={{ margin: "2px 0" }}>• {importResult.result.groupSyncs} group syncs</p>
                        <p style={{ margin: "2px 0" }}>• {importResult.result.absences} absences</p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { setShowImport(false); setImportFile(null); setImportResult(null); }}
                    style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "white", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* CLASS TIMETABLES */}
      {displayClasses.length > 0 ? (
        <>
          {displayClasses.map(c => {
              const periodsDay = c.periodsPerDay || 6;
              const breakAfter = c.schoolTiming?.breakAfter || 3;
              const periodDuration = c.schoolTiming?.periodDuration || 40;
              const breakDuration = c.schoolTiming?.breakDuration || 20;

              let minutes = (c.schoolTiming?.startTime || "08:00").split(":").map(Number);
              let totalMin = minutes[0] * 60 + minutes[1];
              totalMin += periodDuration * breakAfter;
              
              const breakStartHours = Math.floor(totalMin / 60);
              const breakStartMins = totalMin % 60;
              const breakStart = `${String(breakStartHours).padStart(2, "0")}:${String(breakStartMins).padStart(2, "0")}`;

              totalMin += breakDuration;
              const breakEndHours = Math.floor(totalMin / 60);
              const breakEndMins = totalMin % 60;
              const breakEnd = `${String(breakEndHours).padStart(2, "0")}:${String(breakEndMins).padStart(2, "0")}`;

              return (
                <div key={c._id} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h3 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "var(--text-primary)" }}>
                      {c.name} — {periodsDay} periods/day
                    </h3>
                    <button
                      onClick={async () => {
                        const res = await apiFetch(`/export-pdf/${c._id}`);
                        if (!res.ok) { alert("Failed to export PDF"); return; }
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${c.name}-timetable.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(() => URL.revokeObjectURL(url), 10000);
                      }}
                      style={{
                        ...buttonSecondary,
                        background: "#f0f9ff",
                        borderColor: "#0ea5e9"
                      }}
                    >
                      📥 Download PDF
                    </button>
                  </div>

                  {(!c.timetable || c.timetable.length === 0) ? (
                    <p style={{ color: "var(--text-secondary)", fontSize: "16px" }}>
                      {isStudent ? "No timetable generated yet for your class." : "No timetable yet. Click Generate above."}
                    </p>
                  ) : (
                    <>
                      <div className="table-wrap" style={{ overflowX: "auto", marginBottom: "20px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <table className="responsive-table" style={{ borderCollapse: "collapse", fontSize: "14px", width: "100%" }}>
                          <thead>
                            <tr style={{ background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)" }}>
                              <th style={{ padding: "12px", textAlign: "left", borderBottom: "2px solid #cbd5e1", fontWeight: "700", color: "var(--text-table-header)", fontSize: "15px" }}>📅 Day</th>
                              {Array.from({ length: periodsDay }).map((_, i) => (
                                <th
                                  key={i}
                                  style={{
                                    padding: "12px",
                                    textAlign: "center",
                                    borderBottom: "2px solid #cbd5e1",
                                    minWidth: "120px",
                                    fontWeight: "700",
                                    fontSize: "15px",
                                    color: i === breakAfter - 1 ? "#d97706" : "#0c4a6e",
                                    background: i === breakAfter - 1 ? "#fef3c7" : "transparent"
                                  }}
                                >
                                  P{i + 1}
                                </th>
                              ))}
                            </tr>
                            {/* TIMING ROW */}
                            <tr style={{ background: "#f8fafc" }}>
                              <td style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #cbd5e1", fontWeight: "600", color: "var(--text-tertiary)", fontSize: "12px" }}>
                                ⏰ Time
                              </td>
                              {Array.from({ length: periodsDay }).map((_, i) => {
                                const firstPeriod = c.timetable?.[0]?.periods.find(p => p.period === i + 1);
                                return (
                                  <td
                                    key={i}
                                    style={{
                                      padding: "8px 12px",
                                      textAlign: "center",
                                      borderBottom: "1px solid #cbd5e1",
                                      fontWeight: "600",
                                      color: "var(--text-tertiary)",
                                      fontSize: "12px",
                                      background: i === breakAfter - 1 ? "#fef3c7" : "transparent"
                                    }}
                                  >
                                    {firstPeriod ? `${firstPeriod.startTime}-${firstPeriod.endTime}` : "—"}
                                  </td>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {DAYS.map(dayName => {
                              const dayData = c.timetable.find(d => d.day === dayName);
                              return (
                                <tr key={dayName}>
                                  <td style={{ padding: "12px", fontWeight: "700", fontSize: "15px", background: "#f0f9ff", borderBottom: "1px solid #e2e8f0", color: "var(--text-table-header)" }}>
                                    {dayName}
                                  </td>
                                  {Array.from({ length: periodsDay }).map((_, i) => {
                                    const period = dayData?.periods.find(p => p.period === i + 1);
                                    const isFree = !period || period.subject === "Free Period";

                                    return (
                                      <td
                                        key={i}
                                        onClick={() => { if (editMode) openEditPopup(c._id, dayName, i + 1); }}
                                        title={editMode ? "Click to edit this cell" : ""}
                                        style={{
                                          padding: "12px 8px",
                                          textAlign: "center",
                                          borderBottom: "1px solid #e2e8f0",
                                          cursor: editMode ? "pointer" : "default",
                                          background: editMode ? "#f0f9ff" : i === breakAfter - 1 ? "#fef3c7" : isFree ? "#f8fafc" : "#fff",
                                          outline: editMode ? "2px dashed #93c5fd" : "none",
                                          outlineOffset: "-1px",
                                          fontSize: "13px"
                                        }}
                                      >
                                        {period?.tracks && period.tracks.length > 0 ? (
                                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                            {period.tracks.map((tr, ti) => (
                                              <div key={ti} style={{
                                                borderTop: ti > 0 ? "1px dashed #cbd5e1" : "none",
                                                paddingTop: ti > 0 ? "6px" : "0",
                                              }}>
                                                <div style={{ fontWeight: "700", color: "var(--text-primary)", fontSize: "13px" }}>
                                                  {tr.groupName}
                                                </div>
                                                <div style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: "500" }}>
                                                  {tr.teacher?.name || "—"}
                                                </div>
                                                <div style={{ color: "#6b7280", fontSize: "11px", fontWeight: "400" }}>
                                                  {tr.subject}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : isFree ? (
                                          <span style={{ color: "#cbd5e1", fontWeight: "600", fontSize: "13px" }}>Free</span>
                                        ) : (
                                          <>
                                            <div style={{ fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px", fontSize: "14px" }}>{period.subject}</div>
                                            <div style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: "500" }}>{period.teacher?.name || "—"}</div>
                                          </>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}

                            {/* BREAK ROW */}
                            <tr>
                              <td style={{ padding: "12px", fontWeight: "700", fontSize: "15px", background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)", borderBottom: "2px solid #d97706", color: "var(--text-break)" }}>
                                ☕ BREAK
                              </td>
                              <td
                                colSpan={periodsDay}
                                style={{
                                  padding: "12px",
                                  textAlign: "center",
                                  background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                                  borderBottom: "2px solid #d97706",
                                  fontWeight: "700",
                                  color: "var(--text-break)",
                                  fontSize: "14px"
                                }}
                              >
                                {breakStart} - {breakEnd} ({breakDuration} min)
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {quotaSummary && quotaSummary[c.name] && (
                        <div style={{
                          background: "linear-gradient(135deg, #f0fdf4 0%, #e0fce8 100%)",
                          border: "1px solid #bbf7d0",
                          borderRadius: "8px",
                          padding: "16px",
                          fontSize: "14px"
                        }}>
                          <strong style={{ color: "var(--text-success)", fontSize: "15px" }}>📊 Quota Summary</strong>
                          <table style={{ width: "100%", marginTop: "12px", fontSize: "13px", borderCollapse: "collapse" }}>
                            <tbody>
                              {quotaSummary[c.name].teachers?.map(t => (
                                <tr key={t.name} style={{ borderBottom: "1px solid #d1fae5" }}>
                                  <td style={{ padding: "6px 8px" }}>
                                    <strong style={{ color: "var(--text-success)" }}>{t.name}</strong> <span style={{ color: "#059669" }}>({t.subject})</span>
                                  </td>
                                  <td style={{ padding: "6px 8px", textAlign: "center" }}>
                                    {t.got}/{t.target} {t.got === t.target ? "✅" : t.got < t.target ? "⚠️" : "❌"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
        </>
      ) : (
        <div style={cardStyle}>
          <p style={{ color: "var(--text-secondary)", fontSize: "16px", textAlign: "center" }}>
            {isStudent ? "Could not load your class timetable." : "No classes created yet. Add classes in the Classes tab first."}
          </p>
        </div>
      )}

      {/* EDIT PERIOD POPUP */}
      {editPopup && (() => {
        const cls = classes.find(c => c._id === editPopup.classId);
        const teachers = cls?.teachers || [];
        return (
          <div style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }} onClick={() => setEditPopup(null)}>
            <div style={{
              background: "var(--bg-card, white)",
              padding: "28px",
              borderRadius: "16px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              width: "380px",
              maxWidth: "90vw",
            }} onClick={e => e.stopPropagation()}>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>
                ✏️ Edit Period
              </h3>
              <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "var(--text-secondary)" }}>
                {editPopup.day} — Period {editPopup.period}
              </p>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                  👨‍🏫 Single Teacher
                </label>
                <select
                  value={editTeacher}
                  onChange={e => setEditTeacher(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border, #e2e8f0)",
                    fontSize: "15px",
                    outline: "none",
                    boxSizing: "border-box",
                    background: "var(--bg-input, white)",
                    color: "var(--text-primary, #0f172a)",
                  }}
                >
                  <option value="">— Free Period —</option>
                  {teachers.map(t => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({t.subject})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                  📖 Subject
                </label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={e => setEditSubject(e.target.value)}
                  placeholder="Subject name (leave empty for Free Period)"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border, #e2e8f0)",
                    fontSize: "15px",
                    outline: "none",
                    boxSizing: "border-box",
                    background: "var(--bg-input, white)",
                    color: "var(--text-primary, #0f172a)",
                  }}
                />
              </div>

              {/* TRACKS (elective groups) */}
              <div style={{
                borderTop: "1px solid var(--border, #e2e8f0)",
                paddingTop: "16px",
                marginBottom: "20px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                    🎯 Elective Groups (optional)
                  </label>
                  <button
                    onClick={() => setEditTracks([...editTracks, { groupName: "", teacher: "", subject: "" }])}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#3b82f6",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "4px 8px",
                    }}
                  >
                    + Add Group
                  </button>
                </div>

                {editTracks.length === 0 && (
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>
                    No groups. Add multiple teachers for split periods (e.g. Math/Bio in same slot).
                  </p>
                )}

                {editTracks.map((tr, ti) => (
                  <div key={ti} style={{
                    background: "#f8fafc",
                    borderRadius: "8px",
                    padding: "12px",
                    marginBottom: "10px",
                    border: "1px solid #e2e8f0",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Group {ti + 1}</span>
                      <button
                        onClick={() => setEditTracks(editTracks.filter((_, i) => i !== ti))}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ef4444",
                          fontSize: "18px",
                          cursor: "pointer",
                          padding: "0 4px",
                          lineHeight: 1,
                        }}
                        title="Remove group"
                      >
                        ×
                      </button>
                    </div>
                    <div style={{ marginBottom: "8px" }}>
                      <input
                        type="text"
                        value={tr.groupName}
                        onChange={e => {
                          const next = [...editTracks];
                          next[ti] = { ...next[ti], groupName: e.target.value };
                          setEditTracks(next);
                        }}
                        placeholder="Group name (e.g. Math, Bio, CS)"
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--border, #e2e8f0)",
                          fontSize: "14px",
                          outline: "none",
                          boxSizing: "border-box",
                          background: "white",
                          color: "var(--text-primary, #0f172a)",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <select
                        value={tr.teacher}
                        onChange={e => {
                          const next = [...editTracks];
                          next[ti] = { ...next[ti], teacher: e.target.value };
                          setEditTracks(next);
                        }}
                        style={{
                          flex: 1,
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--border, #e2e8f0)",
                          fontSize: "14px",
                          outline: "none",
                          background: "white",
                          color: "var(--text-primary, #0f172a)",
                        }}
                      >
                        <option value="">— Select teacher —</option>
                        {teachers.map(t => (
                          <option key={t._id} value={t._id}>
                            {t.name} ({t.subject})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={tr.subject}
                        onChange={e => {
                          const next = [...editTracks];
                          next[ti] = { ...next[ti], subject: e.target.value };
                          setEditTracks(next);
                        }}
                        placeholder="Subject"
                        style={{
                          flex: 1,
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--border, #e2e8f0)",
                          fontSize: "14px",
                          outline: "none",
                          boxSizing: "border-box",
                          background: "white",
                          color: "var(--text-primary, #0f172a)",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={saveEditPeriod}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                    color: "white",
                    fontSize: "15px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  💾 Save
                </button>
                <button
                  onClick={() => setEditPopup(null)}
                  style={{
                    padding: "12px 20px",
                    borderRadius: "8px",
                    border: "1px solid var(--border, #e2e8f0)",
                    background: "transparent",
                    color: "var(--text-primary, #0f172a)",
                    fontSize: "15px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
