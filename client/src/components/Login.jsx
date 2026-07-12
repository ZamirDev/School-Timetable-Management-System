import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function Login({ onForgot }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Email and password required"); return; }
    setBusy(true);
    try {
      await login(email, password);
      toast.success("Signed in successfully");
    } catch (err) {
      toast.error(err.message || "Login failed");
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
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 40px 10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border, #e2e8f0)",
                fontSize: "16px",
                outline: "none",
                boxSizing: "border-box",
                background: "var(--bg-input, white)",
                color: "var(--text-primary, #0f172a)",
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0.6,
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "1"}
              onMouseLeave={e => e.currentTarget.style.opacity = "0.6"}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div style={{ textAlign: "right", marginBottom: "16px" }}>
          <button
            type="button"
            onClick={onForgot}
            style={{
              background: "none",
              border: "none",
              color: "#3b82f6",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            Forgot Password?
          </button>
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
