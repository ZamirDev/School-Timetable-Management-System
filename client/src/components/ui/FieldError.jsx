export default function FieldError({ message }) {
  if (!message) return null;

  return (
    <p style={{ margin: "6px 0 0", color: "#dc2626", fontSize: "12px", fontWeight: "600" }}>
      {message}
    </p>
  );
}
