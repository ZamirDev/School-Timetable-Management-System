const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const cardStyle = {
  background: "var(--bg-card)",
  borderRadius: "12px",
  padding: "24px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: "24px",
  border: "1px solid var(--border-color)"
};

const headerStyle = {
  margin: "0 0 8px 0",
  fontSize: "22px",
  fontWeight: "700",
  color: "var(--text-primary)"
};

const subStyle = {
  margin: "0 0 24px 0",
  fontSize: "15px",
  color: "var(--text-secondary)"
};

export default function MyTimetable({ user, classes, teachers }) {
  const teacherRef = user?.teacherRef;
  const myTeacher = teachers.find(t => String(t._id) === String(teacherRef));
  const teacherName = myTeacher?.name || "Unknown";

  if (!teacherRef) {
    return (
      <div style={cardStyle}>
        <p style={{ color: "var(--text-secondary)", fontSize: "16px" }}>
          No teacher profile linked to your account. Contact an admin.
        </p>
      </div>
    );
  }

  if (teachers.length === 0) {
    return (
      <div style={cardStyle}>
        <p style={{ color: "var(--text-secondary)", fontSize: "16px" }}>
          ⏳ Loading your timetable...
        </p>
      </div>
    );
  }

  if (!myTeacher) {
    return (
      <div style={cardStyle}>
        <p style={{ color: "var(--text-secondary)", fontSize: "16px" }}>
          Teacher profile not found in system. Contact an admin to link your account.
        </p>
      </div>
    );
  }

  const maxPeriods = Math.max(...classes.map(c => c.periodsPerDay || 6), 6);

  const grid = {};
  for (const day of DAYS) {
    grid[day] = Array.from({ length: maxPeriods }, () => []);
  }

  for (const cls of classes) {
    if (!cls.timetable) continue;
    for (const dayData of cls.timetable) {
      if (!grid[dayData.day]) continue;
      for (const period of dayData.periods) {
        if (!period.teacher || period.subject === "Free Period") continue;
        const tid = period.teacher._id || period.teacher;
        if (String(tid) === String(teacherRef)) {
          grid[dayData.day][period.period - 1].push({
            class: cls.name,
            subject: period.subject,
            periodNum: period.period,
            startTime: period.startTime,
            endTime: period.endTime
          });
        }
      }
    }
  }

  const hasTimetable = classes.some(c => c.timetable && c.timetable.length > 0);

  return (
    <div>
      <div style={cardStyle}>
        <h2 style={headerStyle}>📋 My Weekly Timetable</h2>
        <p style={subStyle}>
          <strong style={{ fontSize: "16px" }}>{teacherName}</strong>
          {myTeacher.subject ? <span> — {myTeacher.subject}</span> : null}
        </p>

        {!hasTimetable ? (
          <p style={{ color: "var(--text-secondary)", fontSize: "16px" }}>
            No timetables generated yet. Contact an admin to generate them.
          </p>
        ) : (
          <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <table style={{ borderCollapse: "collapse", fontSize: "14px", width: "100%" }}>
              <thead>
                <tr style={{ background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)" }}>
                  <th style={{ padding: "12px", textAlign: "left", borderBottom: "2px solid #cbd5e1", fontWeight: "700", color: "var(--text-table-header)", fontSize: "15px" }}>📅 Day</th>
                  {Array.from({ length: maxPeriods }).map((_, i) => (
                    <th key={i} style={{ padding: "12px", textAlign: "center", borderBottom: "2px solid #cbd5e1", minWidth: "140px", fontWeight: "700", fontSize: "15px", color: "#0c4a6e" }}>
                      P{i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map(day => {
                  const periods = grid[day];
                  return (
                    <tr key={day}>
                      <td style={{ padding: "12px", fontWeight: "700", fontSize: "15px", background: "#f0f9ff", borderBottom: "1px solid #e2e8f0", color: "var(--text-table-header)" }}>
                        {day}
                      </td>
                      {periods.map((assignments, idx) => {
                        const isFree = assignments.length === 0;
                        return (
                          <td key={idx} style={{ padding: "10px 8px", textAlign: "center", borderBottom: "1px solid #e2e8f0", background: isFree ? "#f8fafc" : "#fff", fontSize: "13px" }}>
                            {isFree ? (
                              <span style={{ color: "#cbd5e1", fontWeight: "600", fontSize: "13px" }}>—</span>
                            ) : (
                              assignments.map((a, i) => (
                                <div key={i} style={{ marginBottom: i < assignments.length - 1 ? "8px" : 0 }}>
                                  <div style={{ fontWeight: "700", color: "var(--text-primary)", fontSize: "14px" }}>{a.class}</div>
                                  <div style={{ color: "#0369a1", fontSize: "12px", fontWeight: "600" }}>{a.subject}</div>
                                </div>
                              ))
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
