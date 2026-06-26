const tabStyle = (isActive) => ({
  padding: "16px 20px",
  fontSize: "16px",
  fontWeight: "600",
  background: "transparent",
  color: isActive ? "white" : "var(--text-secondary)",
  border: "none",
  cursor: "pointer",
  transition: "all 0.3s ease",
  textAlign: "left",
  width: "100%",
  borderRadius: "8px",
  margin: "8px 0"
});

const activeBg = "linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)";

export default function Tabs({ currentTab, setCurrentTab, role }) {
  const isAdmin = role === "admin";
  const isTeacher = role === "teacher";

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      width: "220px",
      background: "var(--bg-sidebar)",
      padding: "20px",
      borderRadius: "12px",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
      height: "fit-content",
      position: "sticky",
      top: "20px"
    }}>
      {isTeacher && (
        <button
          onClick={() => setCurrentTab("my-timetable")}
          style={{
            ...tabStyle(currentTab === "my-timetable"),
            background: currentTab === "my-timetable" ? activeBg : "var(--bg-tab-inactive)",
            color: currentTab === "my-timetable" ? "white" : "var(--text-secondary)"
          }}
        >
          🗓️ My Timetable
        </button>
      )}
      {isTeacher && (
        <button
          onClick={() => setCurrentTab("my-requests")}
          style={{
            ...tabStyle(currentTab === "my-requests"),
            background: currentTab === "my-requests" ? activeBg : "var(--bg-tab-inactive)",
            color: currentTab === "my-requests" ? "white" : "var(--text-secondary)"
          }}
        >
          📋 My Requests
        </button>
      )}
      <button
        onClick={() => setCurrentTab("timetable")}
        style={{
          ...tabStyle(currentTab === "timetable"),
          background: currentTab === "timetable" ? activeBg : "var(--bg-tab-inactive)",
          color: currentTab === "timetable" ? "white" : "var(--text-secondary)"
        }}
      >
        📅 Timetable
      </button>
      <button
        onClick={() => setCurrentTab("classes")}
        style={{
          ...tabStyle(currentTab === "classes"),
          background: currentTab === "classes" ? activeBg : "var(--bg-tab-inactive)",
          color: currentTab === "classes" ? "white" : "var(--text-secondary)"
        }}
      >
        📚 Classes
      </button>
      <button
        onClick={() => setCurrentTab("teachers")}
        style={{
          ...tabStyle(currentTab === "teachers"),
          background: currentTab === "teachers" ? activeBg : "var(--bg-tab-inactive)",
          color: currentTab === "teachers" ? "white" : "var(--text-secondary)"
        }}
      >
        👨‍🏫 Teachers
      </button>
      <button
        onClick={() => setCurrentTab("absences")}
        style={{
          ...tabStyle(currentTab === "absences"),
          background: currentTab === "absences" ? activeBg : "var(--bg-tab-inactive)",
          color: currentTab === "absences" ? "white" : "var(--text-secondary)"
        }}
      >
        Teacher Leave
      </button>
      {isAdmin && (
        <button
          onClick={() => setCurrentTab("leave-requests")}
          style={{
            ...tabStyle(currentTab === "leave-requests"),
            background: currentTab === "leave-requests" ? activeBg : "var(--bg-tab-inactive)",
            color: currentTab === "leave-requests" ? "white" : "var(--text-secondary)"
          }}
        >
          📩 Leave Requests
        </button>
      )}
      {isAdmin && (
        <button
          onClick={() => setCurrentTab("accounts")}
          style={{
            ...tabStyle(currentTab === "accounts"),
            background: currentTab === "accounts" ? activeBg : "var(--bg-tab-inactive)",
            color: currentTab === "accounts" ? "white" : "var(--text-secondary)"
          }}
        >
          Accounts
        </button>
      )}
    </div>
  );
}
