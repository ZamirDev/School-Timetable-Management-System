import { useState, useEffect } from "react";
import { buttonPrimary, cardStyle } from "../utils/styles";

export default function GroupSyncPanel({ classes, teachers, apiFetch, role }) {
  const isAdmin = role === "admin";

  const [syncs, setSyncs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classA, setClassA] = useState("");
  const [classB, setClassB] = useState("");
  const [groupA, setGroupA] = useState("");
  const [groupB, setGroupB] = useState("");
  const [msg, setMsg] = useState(null);

  const fetchSyncs = async () => {
    setLoading(true);
    try {
      const r = await apiFetch("/group-syncs");
      const data = await r.json();
      setSyncs(data);
    } catch (e) {
      setSyncs([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSyncs(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive groups for each selected class
  const classAGroups = classA
    ? (classes.find(c => c._id === classA)?.teacherGroups || [])
    : [];
  const classBGroups = classB
    ? (classes.find(c => c._id === classB)?.teacherGroups || [])
    : [];

  // Resolve teacher IDs for selected groups
  const resolveGroupTeacherIds = (clsId, groupName) => {
    const cls = classes.find(c => c._id === clsId);
    if (!cls) return [];
    const g = (cls.teacherGroups || []).find(g => g.groupName === groupName);
    if (!g) return [];
    return g.teachers.map(t => String(t._id ?? t)).sort();
  };

  const tidsA = groupA ? resolveGroupTeacherIds(classA, groupA) : [];
  const tidsB = groupB ? resolveGroupTeacherIds(classB, groupB) : [];
  const teachersMatch = tidsA.length > 0 && tidsB.length > 0 && JSON.stringify(tidsA) === JSON.stringify(tidsB);

  const getGroupTeacherNames = (clsId, groupName) => {
    const cls = classes.find(c => c._id === clsId);
    if (!cls) return "";
    const g = (cls.teacherGroups || []).find(g => g.groupName === groupName);
    if (!g) return "";
    return g.teachers.map(t => {
      const teacher = teachers.find(tt => String(tt._id) === String(t._id ?? t));
      return teacher ? `${teacher.name} (${teacher.subject})` : "?";
    }).join(", ");
  };

  const handleSync = async () => {
    if (!classA || !classB || !groupA || !groupB || !teachersMatch) return;
    setMsg(null);
    try {
      const r = await apiFetch("/group-syncs", {
        method: "POST",
        body: JSON.stringify({
          classIds: [classA, classB],
          teacherIds: tidsA,
          groupName: groupA,
        }),
      });
      if (!r.ok) {
        const err = await r.json();
        setMsg({ type: "error", text: err.error || "Failed to sync" });
        return;
      }
      setMsg({ type: "success", text: "Groups synced! Generate the timetable to see them aligned." });
      setClassA("");
      setClassB("");
      setGroupA("");
      setGroupB("");
      fetchSyncs();
    } catch (e) {
      setMsg({ type: "error", text: "Failed to sync groups" });
    }
  };

  const handleDeleteSync = async (syncId) => {
    await apiFetch(`/group-syncs/${syncId}`, { method: "DELETE" });
    fetchSyncs();
  };

  if (!isAdmin) return null;

  return (
    <div>
      {/* Title */}
      <div style={{ ...cardStyle, marginBottom: "16px", padding: "16px" }}>
        <h2 style={{ margin: "0 0 6px 0", fontSize: "20px", fontWeight: "700", color: "var(--text-primary)" }}>
          Sync Groups Across Classes
        </h2>
        <p style={{ margin: 0, fontSize: "14px", color: "var(--text-secondary)" }}>
          Link the same teacher group across two classes so they always share the same time slot.
        </p>
      </div>

      {/* Sync form */}
      <div style={{ ...cardStyle, marginBottom: "16px", padding: "16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {/* Class A */}
          <div>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
              Class A
            </label>
            <select
              value={classA}
              onChange={e => { setClassA(e.target.value); setGroupA(""); }}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "14px", background: "white", color: "#0f172a", marginBottom: "8px", boxSizing: "border-box" }}
            >
              <option value="">Select class...</option>
              {classes.filter(c => c._id !== classB).map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            {classA && classAGroups.length === 0 && (
              <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>No teacher groups in this class.</p>
            )}
            {classAGroups.length > 0 && (
              <select
                value={groupA}
                onChange={e => setGroupA(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "14px", background: "white", color: "#0f172a", boxSizing: "border-box" }}
              >
                <option value="">Select group...</option>
                {classAGroups.map(g => (
                  <option key={g.groupName} value={g.groupName}>{g.groupName}</option>
                ))}
              </select>
            )}
            {groupA && (
              <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                Teachers: {getGroupTeacherNames(classA, groupA)}
              </p>
            )}
          </div>

          {/* Class B */}
          <div>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
              Class B
            </label>
            <select
              value={classB}
              onChange={e => { setClassB(e.target.value); setGroupB(""); }}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "14px", background: "white", color: "#0f172a", marginBottom: "8px", boxSizing: "border-box" }}
            >
              <option value="">Select class...</option>
              {classes.filter(c => c._id !== classA).map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            {classB && classBGroups.length === 0 && (
              <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>No teacher groups in this class.</p>
            )}
            {classBGroups.length > 0 && (
              <select
                value={groupB}
                onChange={e => setGroupB(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "14px", background: "white", color: "#0f172a", boxSizing: "border-box" }}
              >
                <option value="">Select group...</option>
                {classBGroups.map(g => (
                  <option key={g.groupName} value={g.groupName}>{g.groupName}</option>
                ))}
              </select>
            )}
            {groupB && (
              <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                Teachers: {getGroupTeacherNames(classB, groupB)}
              </p>
            )}
          </div>
        </div>

        {/* Match indicator */}
        {groupA && groupB && (
          <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            {teachersMatch ? (
              <>
                <span style={{ color: "#10b981", fontSize: "18px", fontWeight: "bold" }}>[OK]</span>
                <span style={{ fontSize: "14px", color: "#0f766e", fontWeight: 600 }}>Groups match! Ready to sync.</span>
              </>
            ) : (
              <>
                <span style={{ color: "#f59e0b", fontSize: "18px", fontWeight: "bold" }}>[!]</span>
                <span style={{ fontSize: "14px", color: "#92400e", fontWeight: 600 }}>Groups don't have the same teachers.</span>
              </>
            )}
          </div>
        )}

        <button
          onClick={handleSync}
          disabled={!teachersMatch}
          style={{
            ...buttonPrimary,
            marginTop: "12px",
            padding: "10px 20px",
            fontSize: "15px",
            opacity: teachersMatch ? 1 : 0.5,
            cursor: teachersMatch ? "pointer" : "not-allowed",
          }}
        >
          Sync Selected Groups
        </button>

        {msg && (
          <div style={{
            marginTop: "12px",
            padding: "10px 14px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            background: msg.type === "success" ? "#ecfdf5" : "#fef2f2",
            color: msg.type === "success" ? "#0f766e" : "#dc2626",
            border: `1px solid ${msg.type === "success" ? "#bbf7d0" : "#fecaca"}`,
          }}>
            {msg.text}
          </div>
        )}
      </div>

      {/* Existing syncs */}
      <div style={{ ...cardStyle, marginBottom: "16px", padding: "16px" }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
          Active Syncs
        </h3>
        {loading ? (
          <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Loading...</p>
        ) : syncs.length === 0 ? (
          <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>No group syncs yet.</p>
        ) : (
          syncs.map(sync => (
            <div key={sync._id} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              borderRadius: "8px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              marginBottom: "8px",
              fontSize: "14px",
            }}>
              <div>
                <strong style={{ color: "var(--text-primary)" }}>{sync.groupName}</strong>
                <span style={{ color: "var(--text-secondary)", marginLeft: "8px" }}>
                  {(sync.classIds || []).map(c => c.name || "?").join(" ↔ ")}
                </span>
              </div>
              <button
                onClick={() => handleDeleteSync(sync.syncId)}
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
          ))
        )}
      </div>
    </div>
  );
}
