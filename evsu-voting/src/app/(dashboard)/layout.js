"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";

export default function DashboardLayout({ children }) {
  const [role, setRole] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadRole = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setRole(profile?.role || "student");
      }
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
