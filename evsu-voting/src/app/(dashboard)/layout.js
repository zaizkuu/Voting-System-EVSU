"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";

export default function DashboardLayout({ children }) {
  const [role, setRole] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadRole = async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.user) {
          setRole(data.user.role || "student");
        }
      } catch {}
      setLoaded(true);
    };
    loadRole();
  }, []);

  if (!loaded) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary)",
      }}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
          animation: "fadeIn 0.4s ease",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "linear-gradient(135deg, var(--maroon), var(--maroon-dark))",
            animation: "pulseGlow 1.5s infinite",
          }} />
          <span style={{ fontSize: "0.85rem", color: "var(--gray-400)", fontWeight: 500 }}>
            Loading...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>
      <Navbar role={role} />
      <main style={{ flex: 1 }}>
        {children}
      </main>
    </div>
  );
}
