import { useState } from "react";
import toast from "react-hot-toast";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ForgotPassword({ onBack }) {
  const [step, setStep] = useState("email"); // "email" | "reset" | "done"
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const requestToken = async (e) => {
    e.preventDefault();
    if (!email) { toast.error("Email is required"); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Reset code sent to your email");
      setToken(data.token);
      setStep("reset");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
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
      setStep("done");
    } catch (err) {
      toast.error(err.message);
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
      <div style={{
        background: "var(--bg-card, white)",
        padding: "40px",
        borderRadius: "16px",
        boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
        width: "400px",
      }}>
        {step === "done" ? (
          <>
            <div style={{ textAlign: "center" }}>
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
          </>
        ) : step === "reset" ? (
          <>
            <h1 style={{
              margin: "0 0 8px 0",
              fontSize: "26px",
              fontWeight: 700,
              color: "var(--text-primary, #0f172a)",
            }}>
              Reset Password
            </h1>
            <p style={{
              margin: "0 0 6px 0",
              fontSize: "15px",
              color: "var(--text-secondary, #64748b)",
            }}>
              Token sent to <strong>{email}</strong>
            </p>
            <p style={{
              margin: "0 0 24px 0",
              fontSize: "14px",
              color: "var(--text-secondary, #64748b)",
            }}>
              Enter your new password below.
            </p>

            <div style={{
              background: "#f0fdf4",
              color: "#0f766e",
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              marginBottom: "16px",
              wordBreak: "break-all",
              fontFamily: "monospace",
              maxHeight: "40px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              Token: {token}
            </div>

            <form onSubmit={resetPassword}>
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
          </>
        ) : (
          <>
            <h1 style={{
              margin: "0 0 8px 0",
              fontSize: "26px",
              fontWeight: 700,
              color: "var(--text-primary, #0f172a)",
            }}>
              Forgot Password
            </h1>
            <p style={{
              margin: "0 0 24px 0",
              fontSize: "16px",
              color: "var(--text-secondary, #64748b)",
            }}>
              Enter your email to receive a reset token
            </p>

            <form onSubmit={requestToken}>
              <div style={{ marginBottom: "24px" }}>
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
                {busy ? "Sending..." : "Send Reset Token"}
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
          </>
        )}
      </div>
    </div>
  );
}
