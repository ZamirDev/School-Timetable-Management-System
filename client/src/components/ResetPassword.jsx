import { useState } from "react";
import toast from "react-hot-toast";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ResetPassword({ onBack }) {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) { toast.error("Reset token is required"); return; }
    if (!password) { toast.error("New password is required"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Password reset successfully");
      setDone(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-page, #f8fafc)",
      }}>
        <div style={{
          background: "var(--bg-card, white)",
          padding: "40px",
          borderRadius: "16px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
          width: "400px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "32px", marginBottom: "16px", fontWeight: "bold", color: "#10b981" }}>OK</div>
          <h2 style={{ margin: "0 0 8px 0", color: "var(--text-primary, #0f172a)" }}>
            Password Reset Successful
          </h2>
          <p style={{ color: "var(--text-secondary, #64748b)", marginBottom: "24px" }}>
            You can now login with your new password.
          </p>
          <button
            onClick={onBack}
            style={{
              padding: "12px 32px",
              borderRadius: "8px",
              border: "none",
              background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
              color: "white",
              fontSize: "17px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg-page, #f8fafc)",
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "var(--bg-card, white)",
        padding: "40px",
        borderRadius: "16px",
        boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
        width: "400px",
      }}>
        <h1 style={{
          margin: "0 0 8px 0",
          fontSize: "26px",
          fontWeight: 700,
          color: "var(--text-primary, #0f172a)",
        }}>
          Reset Password
        </h1>
        <p style={{
          margin: "0 0 24px 0",
          fontSize: "16px",
          color: "var(--text-secondary, #64748b)",
        }}>
          Enter your reset token and new password
        </p>

        <div style={{ marginBottom: "16px" }}>
          <label style={{
            display: "block",
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--text-primary, #0f172a)",
            marginBottom: "6px",
          }}>
            Reset Token
          </label>
          <input
            type="text"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="Paste your reset token here"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border, #e2e8f0)",
              fontSize: "14px",
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "monospace",
              background: "var(--bg-input, white)",
              color: "var(--text-primary, #0f172a)",
            }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{
            display: "block",
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--text-primary, #0f172a)",
            marginBottom: "6px",
          }}>
            New Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 6 characters"
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
            }}
          />
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label style={{
            display: "block",
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--text-primary, #0f172a)",
            marginBottom: "6px",
          }}>
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Re-enter new password"
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
            }}
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            border: "none",
            background: busy ? "#94a3b8" : "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            color: "white",
            fontSize: "17px",
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
            marginBottom: "12px",
          }}
        >
          {busy ? "Resetting..." : "Reset Password"}
        </button>
        <button
          type="button"
          onClick={onBack}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid var(--border, #e2e8f0)",
            background: "transparent",
            color: "var(--text-primary, #0f172a)",
            fontSize: "15px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Back to Login
        </button>
      </form>
    </div>
  );
}
