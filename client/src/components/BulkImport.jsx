import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { cardStyle, buttonPrimary } from "../utils/styles";
import { apiFetch } from "../utils/api";

function normalizeRow(raw) {
  const r = {};
  for (const [k, v] of Object.entries(raw)) {
    r[k.toLowerCase().trim()] = typeof v === "string" ? v.trim() : v;
  }
  return r;
}

export default function BulkImport({ classes }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const parseFile = (file) => {
    setResult(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(sheet);
        setRows(raw.map(normalizeRow));
      } catch {
        setRows([]);
        setFileName("");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) parseFile(file);
  };

  const handleImport = async () => {
    setImporting(true);
    setResult(null);
    try {
      const payload = rows.map(r => ({
        type: r.type || "",
        name: r.name || "",
        subject: r.subject || "",
        className: r.class || r.classname || "",
        email: r.email || "",
        password: r.password || "",
      }));

      const res = await apiFetch("/auth/bulk-import", {
        method: "POST",
        body: JSON.stringify({ rows: payload }),
      });
      const data = await res.json();

      if (!res.ok) {
        setResult({ error: data.error || "Import failed" });
      } else {
        setResult(data);
      }
    } catch {
      setResult({ error: "Network error" });
    }
    setImporting(false);
  };

  const reset = () => {
    setRows([]);
    setFileName("");
    setResult(null);
  };

  const classNames = classes?.map(c => c.name) || [];

  return (
    <div style={{ marginTop: "24px" }}>
      <div style={{ ...cardStyle, padding: "20px" }}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "700", color: "var(--text-primary)" }}>
          📦 Bulk Import from Spreadsheet
        </h3>

        <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "var(--text-secondary)" }}>
          Upload an <strong>.xlsx</strong> file with columns: <strong>Type</strong>, <strong>Name</strong>, <strong>Subject</strong> (teachers), <strong>Class</strong> (students), <strong>Email</strong>, <strong>Password</strong>
        </p>

        {classNames.length > 0 && (
          <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "var(--text-secondary)" }}>
            Existing classes: {classNames.join(", ")}
          </p>
        )}

        {rows.length === 0 ? (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragOver ? "#0ea5e9" : "var(--border, #cbd5e1)"}`,
              borderRadius: "10px",
              padding: "40px 20px",
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? "var(--bg-table-hover, #eff6ff)" : "transparent",
              transition: "all 0.2s",
            }}
          >
            <p style={{ margin: "0 0 8px 0", fontSize: "28px" }}>📄</p>
            <p style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "600", color: "var(--text-primary)" }}>
              Click or drag a spreadsheet here
            </p>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>
              Supports .xlsx, .xls, .csv
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              style={{ display: "none" }}
            />
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>
                {fileName} — {rows.length} row{rows.length !== 1 ? "s" : ""} found
              </p>
              <button
                onClick={reset}
                style={{
                  background: "none",
                  border: "none",
                  color: "#ef4444",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: "4px",
                }}
              >
                ✕ Clear
              </button>
            </div>

            <div style={{ overflowX: "auto", maxHeight: "300px", overflowY: "auto", border: "1px solid var(--border, #e2e8f0)", borderRadius: "8px", marginBottom: "16px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", position: "sticky", top: 0 }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "2px solid #e2e8f0", fontWeight: "700", color: "var(--text-secondary)" }}>#</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "2px solid #e2e8f0", fontWeight: "700", color: "var(--text-secondary)" }}>Type</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "2px solid #e2e8f0", fontWeight: "700", color: "var(--text-secondary)" }}>Name</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "2px solid #e2e8f0", fontWeight: "700", color: "var(--text-secondary)" }}>Subject/Class</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "2px solid #e2e8f0", fontWeight: "700", color: "var(--text-secondary)" }}>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "6px 10px", color: "var(--text-secondary)" }}>{i + 1}</td>
                      <td style={{ padding: "6px 10px" }}>
                        <span style={{
                          background: r.type === "teacher" ? "#f0fdf4" : "#eff6ff",
                          color: r.type === "teacher" ? "#0f766e" : "#0369a1",
                          padding: "2px 8px",
                          borderRadius: "10px",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}>
                          {r.type}
                        </span>
                      </td>
                      <td style={{ padding: "6px 10px", fontWeight: 600, color: "var(--text-primary)" }}>{r.name}</td>
                      <td style={{ padding: "6px 10px", color: "var(--text-secondary)" }}>{r.subject || r.class || r.classname || "—"}</td>
                      <td style={{ padding: "6px 10px", color: "var(--text-secondary)", fontSize: "12px" }}>{r.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {result ? (
              <div>
                {result.error ? (
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "14px", marginBottom: "12px" }}>
                    <p style={{ margin: 0, color: "#dc2626", fontWeight: 600, fontSize: "15px" }}>❌ {result.error}</p>
                  </div>
                ) : (
                  <>
                    <div style={{
                      background: result.imported > 0 ? "#f0fdf4" : "#fef3c7",
                      border: `1px solid ${result.imported > 0 ? "#bbf7d0" : "#fde68a"}`,
                      borderRadius: "8px",
                      padding: "14px",
                      marginBottom: "12px",
                    }}>
                      <p style={{ margin: 0, color: result.imported > 0 ? "#0f766e" : "#92400e", fontWeight: 600, fontSize: "15px" }}>
                        ✅ Imported {result.imported}
                        {result.skipped > 0 ? ` · ⚠️ Skipped ${result.skipped} (already exist)` : ""}
                        {result.errors.length > 0 ? ` · ❌ ${result.errors.length} error${result.errors.length > 1 ? "s" : ""}` : ""}
                      </p>
                    </div>

                    {result.errors.length > 0 && (
                      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "12px", marginBottom: "12px" }}>
                        <p style={{ margin: "0 0 8px 0", fontWeight: 700, fontSize: "14px", color: "#dc2626" }}>Row Errors:</p>
                        {result.errors.map((e, i) => (
                          <p key={i} style={{ margin: "2px 0", fontSize: "13px", color: "#dc2626" }}>
                            Row {e.row}: {e.reason}
                          </p>
                        ))}
                      </div>
                    )}

                    <button onClick={reset} style={{ ...buttonPrimary, background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}>
                      Import Another File
                    </button>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={handleImport}
                disabled={importing}
                style={{
                  ...buttonPrimary,
                  width: "100%",
                  background: importing ? "#94a3b8" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  cursor: importing ? "not-allowed" : "pointer",
                  padding: "12px",
                  fontSize: "16px",
                }}
              >
                {importing ? "⏳ Importing..." : `🚀 Import ${rows.length} Record${rows.length !== 1 ? "s" : ""}`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
