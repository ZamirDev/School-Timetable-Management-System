import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Email and password required"); return; }
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

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
        width: "360px",
      }}>
        <h1 style={{
          margin: "0 0 8px 0",
          fontSize: "26px",
          fontWeight: 700,
          color: "var(--text-primary, #0f172a)",
        }}>
          Timetable Manager
        </h1>
        <p style={{
          margin: "0 0 24px 0",
          fontSize: "16px",
          color: "var(--text-secondary, #64748b)",
        }}>
          Sign in to continue
        </p>

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

        <div style={{ marginBottom: "16px" }}>
          <label style={{
            display: "block",
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--text-primary, #0f172a)",
            marginBottom: "6px",
          }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
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
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
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
            transition: "opacity 0.2s",
          }}
        >
          {busy ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
