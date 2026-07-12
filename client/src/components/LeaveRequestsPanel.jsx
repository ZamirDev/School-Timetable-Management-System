import { useState, useEffect } from "react";
import { cardStyle, buttonPrimary } from "../utils/styles";
import { apiFetch } from "../utils/api";

export default function LeaveRequestsPanel() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [actingId, setActingId] = useState(null);
  const [rejectNotes, setRejectNotes] = useState({});

  const fetchRequests = async () => {
    const res = await apiFetch("/leave-requests");
    if (res.ok) setRequests(await res.json());
  };

  useEffect(() => { fetchRequests(); }, []);

  const filtered = filter === "all" ? requests : requests.filter(r => r.status === filter);

  const handleApprove = async (id) => {
    setActingId(id);
    await apiFetch(`/leave-requests/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status: "approved" }),
    });
    setActingId(null);
    await fetchRequests();
  };

  const handleReject = async (id) => {
    const note = rejectNotes[id] || "";
    setActingId(id);
    await apiFetch(`/leave-requests/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status: "rejected", adminNote: note }),
    });
    setActingId(null);
    setRejectNotes(prev => ({ ...prev, [id]: "" }));
    await fetchRequests();
  };

  const statusBadge = (status) => {
    const styles = {
      pending: { bg: "#fef3c7", color: "#92400e", text: "Pending" },
      approved: { bg: "#f0fdf4", color: "#0f766e", text: "Approved" },
      rejected: { bg: "#fef2f2", color: "#dc2626", text: "Rejected" },
    };
    const s = styles[status] || styles.pending;
    return (
      <span style={{ background: s.bg, color: s.color, padding: "3px 10px", borderRadius: "12px", fontSize: "14px", fontWeight: 600 }}>
        {s.text}
      </span>
    );
  };

  return (
    <div>
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 20px 0", fontSize: "22px", fontWeight: "700", color: "var(--text-primary)" }}>
          Leave Requests ({requests.length})
        </h2>

        <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
          {["pending", "approved", "rejected", "all"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 14px",
                borderRadius: "20px",
                border: "none",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                background: filter === f ? "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" : "#f1f5f9",
                color: filter === f ? "white" : "var(--text-primary)",
                textTransform: "capitalize",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", fontSize: "16px" }}>No {filter} requests.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {filtered.map(r => (
              <div key={r._id} style={{
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "10px",
                padding: "16px",
                background: "var(--bg-card, white)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <div>
                    <strong style={{ color: "var(--text-primary)", fontSize: "16px" }}>
                      {r.teacher?.name || "Unknown"}
                    </strong>
                    <span style={{ color: "var(--text-secondary)", fontSize: "14px", marginLeft: "8px" }}>
                      ({r.teacher?.subject || "—"})
                    </span>
                  </div>
                  {statusBadge(r.status)}
                </div>
                <p style={{ margin: "0 0 6px 0", color: "var(--text-primary)", fontSize: "15px" }}>
                  <strong>Days:</strong> {r.startDay ? (r.startDay === r.endDay ? r.startDay : `${r.startDay} - ${r.endDay}`) : r.day}
                </p>
                <p style={{ margin: "0 0 6px 0", color: "var(--text-secondary)", fontSize: "15px" }}>
                  <strong>Reason:</strong> {r.reason || "No reason given"}
                </p>
                {r.adminNote && (
                  <p style={{ margin: "0 0 6px 0", color: "#dc2626", fontSize: "15px" }}>
                    <strong>Admin Note:</strong> {r.adminNote}
                  </p>
                )}
                <p style={{ margin: "0 0 12px 0", color: "var(--text-secondary)", fontSize: "13px" }}>
                  {new Date(r.createdAt).toLocaleString()}
                </p>

                {r.status === "pending" && (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        onClick={() => handleApprove(r._id)}
                        disabled={actingId === r._id}
                        style={{
                          ...buttonPrimary,
                          padding: "6px 16px",
                          fontSize: "14px",
                          background: actingId === r._id ? "#94a3b8" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                          cursor: actingId === r._id ? "not-allowed" : "pointer",
                        }}
                      >
                        {actingId === r._id ? "..." : "Approve"}
                      </button>
                      <input
                        placeholder="Reason for rejection (optional)"
                        value={rejectNotes[r._id] || ""}
                        onChange={e => setRejectNotes(prev => ({ ...prev, [r._id]: e.target.value }))}
                        style={{
                          flex: 1,
                          minWidth: "180px",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid #fecaca",
                          fontSize: "14px",
                          outline: "none",
                          background: "var(--bg-input, white)",
                          color: "var(--text-primary, #0f172a)",
                        }}
                      />
                      <button
                        onClick={() => handleReject(r._id)}
                        disabled={actingId === r._id}
                        style={{
                          ...buttonPrimary,
                          padding: "6px 16px",
                          fontSize: "14px",
                          background: actingId === r._id ? "#94a3b8" : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                          cursor: actingId === r._id ? "not-allowed" : "pointer",
                        }}
                      >
                        {actingId === r._id ? "..." : "Reject"}
                      </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
