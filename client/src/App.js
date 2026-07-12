import { useState, useEffect, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { apiFetch } from "./utils/api";
import Header from "./components/Header";
import Login from "./components/Login";
import ForgotPassword from "./components/ForgotPassword";
import Tabs from "./components/Tabs";
import Timetable from "./components/Timetable";
import ClassesTab from "./components/ClassesTab";
import TeacherTabs from "./components/TeacherTabs";
import AbsencesTab from "./components/AbsencesTab";
import AccountManagement from "./components/AccountManagement";
import TeacherDashboard from "./components/TeacherDashboard";
import LeaveRequestsPanel from "./components/LeaveRequestsPanel";
import MyTimetable from "./components/MyTimetable";
import GroupSyncPanel from "./components/GroupSyncPanel";
import { Toaster, toast } from "react-hot-toast";
import {
  validateClass,
  validatePeriodsPerDay,
  validateQuota,
  validateSchoolTiming,
  validateTeacher,
  validateTeacherAssignment,
} from "./utils/validation";

function AppContent() {
  const { user, loading, logout } = useAuth();

  const [authPage, setAuthPage] = useState("login");

  const [currentTab, setCurrentTab] = useState(
    user?.role === "teacher" ? "my-timetable" :
    user?.role === "student" ? "timetable" :
    "timetable"
  );
  const [configuring, setConfiguring] = useState(null);

  // Teachers
  const [teachers, setTeachers] = useState([]);
  const [tName, setTName] = useState("");
  const [tSubject, setTSubject] = useState("");
  const [editId, setEditId] = useState(null);

  // Classes
  const [classes, setClasses] = useState([]);
  const [className, setClassName] = useState("");
  const [selectedClass, setSelectedClass] = useState(null);

  // Configuration
  const [selTeacher, setSelTeacher] = useState({});
  const [quotaInputs, setQuotaInputs] = useState({});
  const [ppd, setPpd] = useState({});
  const [schoolTiming, setSchoolTiming] = useState({ startTime: "08:00", periodDuration: 40, breakAfter: 3, breakDuration: 20, breaks: [{ after: 3, duration: 20, label: "Break" }] });

  // Timetable
  const [quotaSummary, setQuotaSummary] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [conflictsChecked, setConflictsChecked] = useState(false);

  // Absences
  const [absences, setAbsences] = useState([]);
  const [absenceTeacher, setAbsenceTeacher] = useState("");
  const [absenceDay, setAbsenceDay] = useState("Monday");

  // Validation
  const [teacherErrors, setTeacherErrors] = useState({});
  const [classErrors, setClassErrors] = useState({});
  const [configErrors, setConfigErrors] = useState({});
  const [absenceErrors, setAbsenceErrors] = useState({});

  // Dark mode
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);
  const toggleDarkMode = () => setDarkMode(p => !p);

  // Fetch functions (defined unconditionally)
  const fetchTeachers = useCallback(async () => {
    const r = await apiFetch("/teachers");
    setTeachers(await r.json());
  }, []);

  const fetchClasses = useCallback(async () => {
    const r = await apiFetch("/classes");
    const data = await r.json();
    setClasses(data);

    const ppdMap = {};
    for (const c of data) {
      ppdMap[c._id] = String(c.periodsPerDay || 6);
    }
    setPpd(ppdMap);

    setQuotaInputs(prev => {
      const next = { ...prev };
      for (const c of data) {
        const fromDB = {};
        if (c.teacherQuota && typeof c.teacherQuota === "object") {
          for (const [tid, val] of Object.entries(c.teacherQuota)) {
            fromDB[tid] = String(val);
          }
        }
        const existing = prev[c._id] || {};
        const merged = { ...fromDB };
        for (const [tid, val] of Object.entries(existing)) {
          merged[tid] = val;
        }
        next[c._id] = merged;
      }
      return next;
    });

    const firstClassTiming = data[0]?.schoolTiming || { startTime: "08:00", periodDuration: 40, breakAfter: 3, breakDuration: 20 };
    // Migrate legacy single-break to multi-break
    if (!firstClassTiming.breaks || firstClassTiming.breaks.length === 0) {
      firstClassTiming.breaks = [{ after: firstClassTiming.breakAfter || 3, duration: firstClassTiming.breakDuration || 20, label: "Break" }];
    }
    setSchoolTiming(firstClassTiming);

  }, []);

  const fetchAbsences = useCallback(async () => {
    const r = await apiFetch("/absences");
    setAbsences(await r.json());
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchTeachers().catch(() => {});
    fetchClasses().catch(() => {});
    fetchAbsences().catch(() => {});
  }, [user, fetchTeachers, fetchClasses, fetchAbsences]);

  // Auto-select first class when classes load and none is selected
  useEffect(() => {
    if (!selectedClass && classes.length > 0) {
      setSelectedClass(classes[0]._id);
    }
  }, [classes, selectedClass]);

  // ─────────────────────────────────────
  //  TEACHER ACTIONS
  // ─────────────────────────────────────

  const submitTeacher = async (e) => {
    e.preventDefault();
    const errors = validateTeacher({ name: tName, subject: tSubject });
    setTeacherErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const url = editId ? `/teachers/${editId}` : "/teachers";
    const method = editId ? "PUT" : "POST";
    await apiFetch(url, {
      method,
      body: JSON.stringify({ name: tName.trim(), subject: tSubject.trim() }),
    });
    setTName(""); setTSubject(""); setEditId(null);
    setTeacherErrors({});
    fetchTeachers();
  };

  const validateTeacherField = (field) => {
    const errors = validateTeacher({ name: tName, subject: tSubject });
    setTeacherErrors(prev => ({ ...prev, [field]: errors[field] || "" }));
  };

  const deleteTeacher = async (id) => {
    await apiFetch(`/teachers/${id}`, { method: "DELETE" });
    fetchTeachers();
  };

  const saveAbsence = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!absenceTeacher) errors.teacher = "Select a teacher";
    if (Object.keys(errors).length > 0) {
      setAbsenceErrors(errors);
      return;
    }
    setAbsenceErrors({});
    const res = await apiFetch("/absences", {
      method: "POST",
      body: JSON.stringify({ teacherId: absenceTeacher, day: absenceDay }),
    });
    if (!res.ok) {
      const data = await res.json();
      setAbsenceErrors({ teacher: data.error || "Failed to save absence" });
      return;
    }
    setAbsenceTeacher("");
    fetchAbsences();
  };

  const deleteAbsence = async (id) => {
    await apiFetch(`/absences/${id}`, { method: "DELETE" });
    fetchAbsences();
  };

  // ─────────────────────────────────────
  //  CLASS ACTIONS
  // ─────────────────────────────────────

  const addClass = async () => {
    const errors = validateClass({ name: className, classes });
    setClassErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const res = await apiFetch("/classes", {
      method: "POST",
      body: JSON.stringify({ name: className.trim() }),
    });
    if (!res.ok) {
      const data = await res.json();
      setClassErrors({ name: data.error || "Failed to add class" });
      return;
    }
    setClassName("");
    setClassErrors({});
    fetchClasses();
  };

  const validateClassField = () => {
    const errors = validateClass({ name: className, classes });
    setClassErrors(errors);
  };

  const deleteClass = async (id) => {
    await apiFetch(`/classes/${id}`, { method: "DELETE" });
    fetchClasses();
  };

  const assignTeacher = async (classId, teacherId) => {
    const classItem = classes.find(c => c._id === classId);
    const error = validateTeacherAssignment({ classItem, teacherId });
    setConfigErrors(prev => ({
      ...prev,
      [classId]: { ...(prev[classId] || {}), assignment: error }
    }));
    if (error) return;

    await apiFetch(`/classes/${classId}/assign-teacher`, {
      method: "PUT",
      body: JSON.stringify({ teacherId }),
    });
    fetchClasses();
  };

  const removeTeacher = async (classId, teacherId) => {
    await apiFetch(`/classes/${classId}/remove-teacher`, {
      method: "PUT",
      body: JSON.stringify({ teacherId }),
    });
    fetchClasses();
  };

  const saveTeacherGroups = async (classId, groups) => {
    await apiFetch(`/classes/${classId}/teacher-groups`, {
      method: "PUT",
      body: JSON.stringify({ groups }),
    });
    fetchClasses();
  };

  // ─────────────────────────────────────
  //  PERIODS PER DAY
  // ─────────────────────────────────────

  const savePpd = async (classId) => {
    const error = validatePeriodsPerDay(ppd[classId]);
    setConfigErrors(prev => ({
      ...prev,
      [classId]: { ...(prev[classId] || {}), periodsPerDay: error }
    }));
    if (error) return;

    const val = Number(ppd[classId]);
    await apiFetch(`/classes/${classId}/periods-per-day`, {
      method: "PUT",
      body: JSON.stringify({ periodsPerDay: val }),
    });
    fetchClasses();
  };

  const validateAssignmentField = (classId) => {
    const classItem = classes.find(c => c._id === classId);
    const error = validateTeacherAssignment({ classItem, teacherId: selTeacher[classId] });
    setConfigErrors(prev => ({
      ...prev,
      [classId]: { ...(prev[classId] || {}), assignment: error }
    }));
  };

  const validatePpdField = (classId) => {
    const error = validatePeriodsPerDay(ppd[classId]);
    setConfigErrors(prev => ({
      ...prev,
      [classId]: { ...(prev[classId] || {}), periodsPerDay: error }
    }));
  };

  // ─────────────────────────────────────
  //  SCHOOL TIMING (UNIFIED FOR ALL CLASSES)
  // ─────────────────────────────────────

  const saveSchoolTiming = async () => {
    const timing = schoolTiming || {};
    const errors = validateSchoolTiming({ timing, periodsPerDay: 6 });
    setConfigErrors({
      schoolTiming: errors
    });
    if (Object.keys(errors).length > 0) return;

    const res = await apiFetch("/update-all-classes-timing", {
      method: "PUT",
      body: JSON.stringify({
        startTime: timing.startTime,
        periodDuration: Number(timing.periodDuration),
        breaks: (timing.breaks || []).map(b => ({
          after: Number(b.after),
          duration: Number(b.duration),
          label: b.label
        }))
      }),
    });
    if (res.ok) {
      toast.success("School timing updated for all classes! Please regenerate timetable.");
      fetchClasses();
    } else {
      toast.error("Failed to save school timing");
    }
  };

  const updateSchoolTiming = (field, value) => {
    setSchoolTiming(prev => {
      if (field.includes(".")) {
        const parts = field.split(".");
        const newVal = { ...prev };
        let cur = newVal;
        for (let i = 0; i < parts.length - 1; i++) {
          const key = parts[i];
          const nextKey = parts[i + 1];
          if (Array.isArray(cur[key])) {
            const idx = parseInt(nextKey, 10);
            if (!isNaN(idx)) {
              cur = cur[key];
              cur[idx] = { ...(cur[idx] || {}) };
              cur = cur[idx];
              i++;
            } else {
              cur[key] = { ...(cur[key] || {}) };
              cur = cur[key];
            }
          } else {
            cur[key] = { ...(cur[key] || {}) };
            cur = cur[key];
          }
        }
        cur[parts[parts.length - 1]] = value;
        return newVal;
      }
      return { ...prev, [field]: value };
    });
  };

  const validateSchoolTimingField = (field) => {
    const errors = validateSchoolTiming({ timing: schoolTiming, periodsPerDay: 6 });
    setConfigErrors({
      schoolTiming: { ...((configErrors.schoolTiming || {})), [field]: errors[field] || "" }
    });
  };

  // ─────────────────────────────────────
  //  QUOTA
  // ─────────────────────────────────────

  const handleQuotaChange = (classId, teacherId, value) => {
    setQuotaInputs(prev => ({
      ...prev,
      [classId]: { ...(prev[classId] || {}), [teacherId]: value },
    }));
  };

  const saveQuota = async (classId) => {
    const raw = quotaInputs[classId] || {};
    const cls = classes.find(c => c._id === classId);
    const pdDay = Number(ppd[classId] || cls?.periodsPerDay || 6);
    const total = pdDay * 6;
    const { fieldErrors, formError, cleanQuota } = validateQuota({
      quotaInputs: raw,
      teachers: cls?.teachers || [],
      totalSlots: total,
    });
    setConfigErrors(prev => ({
      ...prev,
      [classId]: { ...(prev[classId] || {}), quota: fieldErrors, quotaForm: formError }
    }));
    if (Object.keys(fieldErrors).length > 0 || formError) return;

    const res = await apiFetch(`/classes/${classId}/quota`, {
      method: "PUT",
      body: JSON.stringify(cleanQuota),
    });

    if (res.ok) {
      const data = await res.json();
      const savedQuota = data.teacherQuota || {};
      setQuotaInputs(prev => ({
        ...prev,
        [classId]: Object.fromEntries(
          Object.entries(savedQuota).map(([tid, val]) => [tid, String(val)])
        ),
      }));
      fetchClasses();
    } else {
      alert("Failed to save quota");
    }
  };

  const validateQuotaField = (classId, teacherId) => {
    const cls = classes.find(c => c._id === classId);
    const totalSlots = Number(ppd[classId] || cls?.periodsPerDay || 6) * 6;
    const { fieldErrors, formError } = validateQuota({
      quotaInputs: quotaInputs[classId] || {},
      teachers: cls?.teachers || [],
      totalSlots,
    });
    setConfigErrors(prev => ({
      ...prev,
      [classId]: {
        ...(prev[classId] || {}),
        quota: { ...((prev[classId] || {}).quota || {}), [teacherId]: fieldErrors[teacherId] || "" },
        quotaForm: formError,
      }
    }));
  };

  const clearTeacherQuota = async (classId, teacherId) => {
    const raw = quotaInputs[classId] || {};
    const quota = {};
    for (const [tid, val] of Object.entries(raw)) {
      if (tid === teacherId || val === "") continue;
      quota[tid] = parseInt(val, 10);
    }
    await apiFetch(`/classes/${classId}/quota`, {
      method: "PUT",
      body: JSON.stringify(quota),
    });
    setQuotaInputs(prev => ({
      ...prev,
      [classId]: { ...(prev[classId] || {}), [teacherId]: "" },
    }));
    fetchClasses();
  };

  // ─────────────────────────────────────
  //  CONFLICT DETECTION
  // ─────────────────────────────────────

  const detectConflicts = () => {
    setConflictsChecked(true);
    const foundConflicts = [];
    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    for (const day of DAYS) {
      for (let p = 1; p <= 12; p++) {
        const assignedTeachers = {};

        for (const cls of classes) {
          if (!cls.timetable) continue;
          const dayData = cls.timetable.find(d => d.day === day);
          if (!dayData) continue;

          const period = dayData.periods.find(pr => pr.period === p);
          if (!period || !period.teacher || period.subject === "Free Period") continue;

          const teacherId = String(period.teacher._id || period.teacher);
          const tname = period.teacher.name || "Unknown";
          const tracks = (period.tracks || []).map(t => ({
            teacher: String(t.teacher?._id || t.teacher),
            groupName: t.groupName,
          }));

          if (!assignedTeachers[teacherId]) {
            assignedTeachers[teacherId] = { name: tname, classes: [] };
          }
          assignedTeachers[teacherId].classes.push({ cls: cls.name, tracks });
        }

        for (const [, data] of Object.entries(assignedTeachers)) {
          if (data.classes.length > 1) {
            const trackStrs = data.classes.map(c => JSON.stringify(c.tracks));
            const allSameTracks = trackStrs.every(s => s === trackStrs[0]);
            if (!allSameTracks) {
              foundConflicts.push({
                day,
                period: p,
                teacher: data.name,
                classes: data.classes.map(c => c.cls),
              });
            }
          }
        }
      }
    }

    setConflicts(foundConflicts);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-page, #f8fafc)" }}>
        <p style={{ color: "var(--text-secondary, #64748b)", fontSize: "16px" }}>Loading...</p>
      </div>
    );
  }

  if (!user) {
    if (authPage === "forgot-password") {
      return <ForgotPassword onBack={() => setAuthPage("login")} />;
    }
    return <Login onForgot={() => setAuthPage("forgot-password")} />;
  }

  return (
    <div style={{ background: "var(--bg-page)", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Header darkMode={darkMode} toggleDarkMode={toggleDarkMode} user={user} onLogout={logout} />

      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 20px", paddingTop: "20px" }}>
        <div className="app-layout" style={{ display: "flex", gap: "24px" }}>
          {/* SIDEBAR */}
          <Tabs currentTab={currentTab} setCurrentTab={setCurrentTab} role={user?.role} />

          {/* MAIN CONTENT */}
          <div key={currentTab} className="main-content animate__animated animate__fadeIn" style={{ flex: 1, minWidth: 0 }}>
            {user?.role === "teacher" && currentTab === "my-timetable" && (
              <MyTimetable user={user} classes={classes} teachers={teachers} />
            )}

            {user?.role === "teacher" && currentTab === "my-requests" && (
              <TeacherDashboard />
            )}

            {user?.role === "admin" && currentTab === "leave-requests" && (
              <LeaveRequestsPanel />
            )}

            {currentTab === "timetable" && (
              <Timetable
                classes={classes}
                selectedClass={selectedClass}
                setSelectedClass={setSelectedClass}
                generating={generating}
                setGenerating={setGenerating}
                quotaSummary={quotaSummary}
                setQuotaSummary={setQuotaSummary}
                fetchClasses={fetchClasses}
                conflicts={conflicts}
                detectConflicts={detectConflicts}
                conflictsChecked={conflictsChecked}
                setConflictsChecked={setConflictsChecked}
                role={user?.role}
                studentClassRef={user?.role === "student" ? user.classRef : null}
              />
            )}

            {user?.role !== "student" && currentTab === "classes" && (
              <ClassesTab
                classes={classes}
                className={className}
                setClassName={setClassName}
                configuring={configuring}
                setConfiguring={setConfiguring}
                teachers={teachers}
                ppd={ppd}
                setPpd={setPpd}
                schoolTiming={schoolTiming}
                updateSchoolTiming={updateSchoolTiming}
                quotaInputs={quotaInputs}
                selTeacher={selTeacher}
                setSelTeacher={setSelTeacher}
                handleQuotaChange={handleQuotaChange}
                addClass={addClass}
                deleteClass={deleteClass}
                assignTeacher={assignTeacher}
                removeTeacher={removeTeacher}
                saveTeacherGroups={saveTeacherGroups}
                saveQuota={saveQuota}
                clearTeacherQuota={clearTeacherQuota}
                savePpd={savePpd}
                saveSchoolTiming={saveSchoolTiming}
                fetchClasses={fetchClasses}
                classErrors={classErrors}
                validateClassField={validateClassField}
                configErrors={configErrors}
                validatePpdField={validatePpdField}
                validateSchoolTimingField={validateSchoolTimingField}
                validateQuotaField={validateQuotaField}
                validateAssignmentField={validateAssignmentField}
                role={user?.role}
              />
            )}

            {user?.role !== "student" && currentTab === "teachers" && (
              <TeacherTabs
                teachers={teachers}
                tName={tName}
                setTName={setTName}
                tSubject={tSubject}
                setTSubject={setTSubject}
                editId={editId}
                setEditId={setEditId}
                submitTeacher={submitTeacher}
                deleteTeacher={deleteTeacher}
                errors={teacherErrors}
                setErrors={setTeacherErrors}
                validateTeacherField={validateTeacherField}
                role={user?.role}
              />
            )}

            {user?.role !== "student" && currentTab === "absences" && (
              <AbsencesTab
                absences={absences}
                teachers={teachers}
                absenceTeacher={absenceTeacher}
                setAbsenceTeacher={setAbsenceTeacher}
                absenceDay={absenceDay}
                setAbsenceDay={setAbsenceDay}
                saveAbsence={saveAbsence}
                deleteAbsence={deleteAbsence}
                errors={absenceErrors}
                setErrors={setAbsenceErrors}
                role={user?.role}
              />
            )}
            {user?.role === "admin" && currentTab === "accounts" && (
              <AccountManagement />
            )}
            {user?.role === "admin" && currentTab === "sync-groups" && (
              <GroupSyncPanel classes={classes} teachers={teachers} apiFetch={apiFetch} role={user?.role} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{
        duration: 3000,
        style: { borderRadius: "10px", padding: "12px 16px", fontSize: "15px" },
        success: { iconTheme: { primary: "#0f766e", secondary: "#fff" } },
        error: { iconTheme: { primary: "#dc2626", secondary: "#fff" } },
      }} />
      <AppContent />
    </AuthProvider>
  );
}
