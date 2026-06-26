import { useState } from "react";
import { cardStyle, buttonPrimary, buttonSecondary } from "../utils/styles";
import { apiFetch } from "../utils/api";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export default function Timetable({ classes, selectedClass, setSelectedClass, generating, setGenerating, quotaSummary, setQuotaSummary, fetchClasses, conflicts, detectConflicts, conflictsChecked, setConflictsChecked, role }) {
  const [selectedSwap, setSelectedSwap] = useState(null);
  const [swapMsg, setSwapMsg] = useState(null);

  const isAdmin = role === "admin";

  const handlePeriodClick = async (classId, day, period) => {
    if (!isAdmin) return;
    if (!selectedSwap) {
      setSelectedSwap({ classId, day, period });
      return;
    }

    // Clicking same cell → deselect
    if (selectedSwap.classId === classId && selectedSwap.day === day && selectedSwap.period === period) {
      setSelectedSwap(null);
      return;
    }

    // Swap must be within same class and day
    if (selectedSwap.classId !== classId || selectedSwap.day !== day) {
      setSwapMsg({ type: "error", text: "Select two periods in the same class and day to swap" });
      setSelectedSwap(null);
      setTimeout(() => setSwapMsg(null), 2000);
      return;
    }

    try {
      const res = await apiFetch(`/classes/${classId}/swap-periods`, {
        method: "PUT",
        body: JSON.stringify({ day, periodA: selectedSwap.period, periodB: period }),
      });

      const data = await res.json();
      if (res.ok) {
        setSwapMsg({ type: "success", text: `Swapped Period ${selectedSwap.period} ↔ Period ${period}` });
        fetchClasses();
      } else {
        setSwapMsg({ type: "error", text: data.error || "Swap rejected" });
      }
    } catch {
      setSwapMsg({ type: "error", text: "Swap failed" });
    }

    setSelectedSwap(null);
    setTimeout(() => setSwapMsg(null), 3000);
  };

  const generateTimetable = async () => {
    setGenerating(true);
    setQuotaSummary(null);
    setConflictsChecked(false);
    await apiFetch("/reset-timetable", { method: "POST" });
    const res = await apiFetch("/generate-timetable", { method: "POST" });
    const data = await res.json();
    if (data.quotaSummary) setQuotaSummary(data.quotaSummary);
    setGenerating(false);
    fetchClasses();
  };

  return (
    <div>
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 20px 0", fontSize: "22px", fontWeight: "700", color: "var(--text-primary)" }}>
          Generate Timetables for All Classes
        </h2>

        {!isAdmin && (
          <p style={{ margin: "0 0 12px 0", fontSize: "15px", color: "var(--text-secondary)", fontStyle: "italic" }}>
            👁️ View-only mode. Contact an admin to make changes.
          </p>
        )}
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
        </div>

        {/* SWAP MESSAGE */}
        {swapMsg && (
          <div style={{
            marginTop: "12px",
            padding: "10px 14px",
            borderRadius: "8px",
            fontSize: "15px",
            fontWeight: "600",
            background: swapMsg.type === "success" ? "#f0fdf4" : "#fef2f2",
            border: swapMsg.type === "success" ? "1px solid #bbf7d0" : "1px solid #fecaca",
            color: swapMsg.type === "success" ? "#0f766e" : "#dc2626",
          }}>
            {swapMsg.type === "success" ? "✅ " : "⚠️ "}{swapMsg.text}
          </div>
        )}

        {/* INSTRUCTION */}
        {isAdmin && (
          <p style={{ margin: "12px 0 0 0", fontSize: "14px", color: "var(--text-secondary)" }}>
            💡 Click a period cell, then click another to swap them (same class, same day)
          </p>
        )}
      </div>

      {/* CONFLICT DETECTION RESULTS */}
      {conflictsChecked && conflicts.length === 0 && (
        <div style={{ ...cardStyle, background: "linear-gradient(135deg, #f0fdf4 0%, #e0fce8 100%)", border: "1px solid #bbf7d0" }}>
          <p style={{ color: "var(--text-success)", fontSize: "16px", margin: 0 }}>✅ No conflicts found. Timetable is valid.</p>
        </div>
      )}

      {conflicts.length > 0 && (
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

      {/* CLASS TIMETABLES */}
      {classes.length > 0 ? (
        <>
          {classes.map(c => {
              const periodsDay = c.periodsPerDay || 6;
              const breakAfter = c.schoolTiming?.breakAfter || 3;
              const periodDuration = c.schoolTiming?.periodDuration || 40;
              const breakDuration = c.schoolTiming?.breakDuration || 20;

              // Calculate break time
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
                    <p style={{ color: "var(--text-secondary)", fontSize: "16px" }}>No timetable yet. Click Generate above.</p>
                  ) : (
                    <>
                      <div style={{ overflowX: "auto", marginBottom: "20px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <table style={{ borderCollapse: "collapse", fontSize: "14px", width: "100%" }}>
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
                                    const isSelected = selectedSwap && selectedSwap.classId === c._id && selectedSwap.day === dayName && selectedSwap.period === i + 1;

                                    return (
                                      <td
                                        key={i}
                                        onClick={() => handlePeriodClick(c._id, dayName, i + 1)}
                                        title="Click to select, click another to swap"
                                        style={{
                                          padding: "12px 8px",
                                          textAlign: "center",
                                          borderBottom: "1px solid #e2e8f0",
                                          cursor: "pointer",
                                          background: isSelected ? "#dbeafe" : i === breakAfter - 1 ? "#fef3c7" : isFree ? "#f8fafc" : "#fff",
                                          outline: isSelected ? "2px solid #3b82f6" : "none",
                                          outlineOffset: "-1px",
                                          fontSize: "13px"
                                        }}
                                      >
                                        {isFree ? (
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
            No classes created yet. Add classes in the Classes tab first.
          </p>
        </div>
      )}
    </div>
  );
}
