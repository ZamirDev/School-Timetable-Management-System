export const cardStyle = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-light)",
  borderRadius: "clamp(8px, 2vw, 12px)",
  padding: "clamp(16px, 4vw, 24px)",
  marginBottom: "clamp(12px, 3vw, 20px)",
  boxShadow: "0 4px 15px rgba(99, 102, 241, 0.08)"
};

export const buttonPrimary = {
  background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
  color: "white",
  padding: "clamp(8px, 2vw, 12px) clamp(16px, 4vw, 24px)",
  border: "none",
  borderRadius: "clamp(6px, 1.5vw, 8px)",
  cursor: "pointer",
  fontSize: "clamp(14px, 3.5vw, 16px)",
  fontWeight: "600",
  transition: "all 0.2s ease",
  boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)"
};

export const buttonSecondary = {
  background: "var(--bg-tab-inactive)",
  color: "var(--text-primary)",
  padding: "clamp(8px, 2vw, 12px) clamp(16px, 4vw, 24px)",
  border: "1px solid var(--border)",
  borderRadius: "clamp(6px, 1.5vw, 8px)",
  cursor: "pointer",
  fontSize: "clamp(14px, 3.5vw, 16px)",
  fontWeight: "500",
  transition: "all 0.2s ease"
};

export const inputStyle = {
  padding: "clamp(8px, 2vw, 12px) clamp(10px, 3vw, 14px)",
  border: "1px solid var(--border)",
  borderRadius: "clamp(6px, 1.5vw, 8px)",
  fontSize: "clamp(14px, 3.5vw, 16px)",
  fontFamily: "inherit",
  background: "var(--bg-input)",
  transition: "all 0.2s ease"
};

export const withValidation = (style, error) => ({
  ...style,
  borderColor: error ? "var(--text-error)" : style.borderColor || "var(--border)",
  background: error ? "var(--bg-error)" : style.background,
});
