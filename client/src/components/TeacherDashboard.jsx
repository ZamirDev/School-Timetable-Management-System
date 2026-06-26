import { useState, useEffect } from "react";
import { cardStyle, buttonPrimary } from "../utils/styles";
import { apiFetch } from "../utils/api";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function TeacherDashboard() {
  const [requests, setRequests] = useState([]);
  const [day, setDay] = useState("Monday");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchRequests = async () => {
    const res = await apiFetch("/leave-requests");
    if (res.ok) setRequests(await res.json());
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!reason.trim()) { setError("Please provide a reason"); return; }
    setBusy(true);
    try {
      const res = await apiFetch("/leave-requests", {
        method: "POST",
        body: JSON.stringify({ day, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to submit request"); return; }
      setReason("");
      await fetchRequests();
    } catch {
      setError("Failed to submit request");
    } finally {
      setBusy(false);
    }
  };

  const statusBadge = (status) => {
    const styles = {
      pending: { bg: "#fef3c7", color: "#92400e", text: "🟡 Pending" },
      approved: { bg: "#f0fdf4", color: "#0f766e", text: "✅ Approved" },
      rejected: { bg: "#fef2f2", color: "#dc2626", text: "❌ Rejected" },
    };
    const s = styles[status] || styles.pending;
    return (
      <span style={{
        background: s.bg,
        color: s.color,
        padding: "3px 10px",
        borderRadius: "12px",
        fontSize: "14px",
        fontWeight: 600,
      }}>
        {s.text}
      </span>
    );
  };

  return (
    <div>
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 20px 0", fontSize: "22px", fontWeight: "700", color: "var(--text-primary)" }}>
          Submit Leave Request
        </h2>

        {error && (
          <div style={{
            background: "#fef2f2",
            color: "#dc2626",
            padding: "10px 14px",
            borderRadius: "8px",
            fontSize: "15px",
            marginBottom: "16px",
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
              Day
            </label>
            <select
              value={day}
              onChange={e => setDay(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border, #e2e8f0)",
                fontSize: "16px",
                outline: "none",
                boxSizing: "border-box",
                background: "var(--bg-input, white)",
                color: "var(--text-primary, #0f172a)",
                cursor: "pointer",
              }}
            >
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
              Reason for Leave
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Why do you need leave?"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border, #e2e8f0)",
                fontSize: "16px",
                outline: "none",
                boxSizing: "border-box",
                background: "var(--bg-input, white)",
                color: "var(--text-primary, #0f172a)",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            style={{
              ...buttonPrimary,
              alignSelf: "flex-start",
              background: busy ? "#94a3b8" : "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Submitting..." : "Submit Request"}
          </button>
        </form>
      </div>

      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 20px 0", fontSize: "22px", fontWeight: "700", color: "var(--text-primary)" }}>
          My Leave Requests ({requests.length})
        </h2>

        {requests.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", fontSize: "16px" }}>No requests submitted yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "15px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border, #e2e8f0)" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>📅 Day</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>📝 Reason</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>🔵 Status</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>📋 Admin Note</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 600 }}>📆 Submitted</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r._id} style={{ borderBottom: "1px solid var(--border, #e2e8f0)" }}>
                    <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontWeight: 600 }}>{r.day}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-primary)" }}>{r.reason || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{statusBadge(r.status)}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{r.adminNote || "—"}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
