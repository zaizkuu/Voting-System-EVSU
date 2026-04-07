"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LogOut,
  Vote,
  User,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function Navbar({ role }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .single();
      if (profile?.full_name) setUserName(profile.full_name);
    };
    loadUser();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const navLinks = role === "admin"
    ? [
        { href: "/admin", label: "Overview" },
        { href: "/admin/elections", label: "Elections" },
        { href: "/admin/students", label: "Students" },
        { href: "/admin/organizations", label: "Organizations" },
        { href: "/admin/results", label: "Results" },
      ]
    : [
        { href: "/student", label: "Dashboard" },
      ];

  const isActive = (href) => {
    if (href === "/admin" || href === "/student") return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <>
      <header style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border-default)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <Link href={role === "admin" ? "/admin" : "/student"} style={{
                display: "flex", alignItems: "center", gap: 10,
                textDecoration: "none", color: "var(--maroon)", fontWeight: 800, fontSize: "1.15rem",
                letterSpacing: "-0.02em",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "linear-gradient(135deg, var(--maroon), var(--maroon-dark))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(128,0,0,0.2)",
                }}>
                  <Vote size={18} color="white" />
                </div>
                <span>EVSU Voting</span>
              </Link>

              {/* Desktop Nav */}
              <nav style={{ display: "flex", gap: 2, marginLeft: 12 }} className="desktop-nav">
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href} style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    color: isActive(link.href) ? "var(--maroon)" : "var(--gray-500)",
                    background: isActive(link.href) ? "var(--maroon-subtle)" : "transparent",
                    transition: "all 0.2s ease",
                    textDecoration: "none",
                  }}>
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Right side */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* User info */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "6px 14px 6px 8px", borderRadius: "var(--radius-full)",
                background: "var(--gray-50)", border: "1px solid var(--border-default)",
              }} className="desktop-nav">
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--maroon), var(--maroon-light))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <User size={14} color="white" />
                </div>
                <div style={{ lineHeight: 1.2 }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--gray-800)" }}>
                    {userName || (role === "admin" ? "Administrator" : "Student")}
                  </span>
                  <span style={{
                    display: "block", fontSize: "0.65rem", fontWeight: 600,
                    color: "var(--maroon)", textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>
                    {role || "student"}
                  </span>
                </div>
              </div>

              {/* Logout */}
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 8,
                  border: "1px solid var(--border-default)",
                  background: "var(--white)", color: "var(--gray-600)",
                  fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
                  transition: "all 0.2s ease", fontFamily: "inherit",
                }}
                onMouseEnter={(e) => { e.target.style.borderColor = "var(--error)"; e.target.style.color = "var(--error)"; }}
                onMouseLeave={(e) => { e.target.style.borderColor = "var(--border-default)"; e.target.style.color = "var(--gray-600)"; }}
              >
                <LogOut size={15} />
                <span className="desktop-nav">Logout</span>
              </button>

              {/* Mobile menu button */}
              <button
                type="button"
                onClick={() => setMobileOpen(!mobileOpen)}
                className="mobile-nav-btn"
                style={{
                  display: "none", padding: 8, borderRadius: 8,
                  border: "1px solid var(--border-default)",
                  background: "var(--white)", color: "var(--gray-600)",
                  cursor: "pointer",
                }}
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileOpen && (
          <div className="mobile-nav-dropdown" style={{
            borderTop: "1px solid var(--border-default)",
            padding: "12px 24px 16px",
            background: "var(--white)",
            animation: "fadeInUp 0.2s ease",
          }}>
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", borderRadius: 8,
                fontSize: "0.9rem", fontWeight: 500,
                color: isActive(link.href) ? "var(--maroon)" : "var(--gray-700)",
                background: isActive(link.href) ? "var(--maroon-subtle)" : "transparent",
                textDecoration: "none", marginBottom: 2,
              }}>
                {link.label}
                <ChevronRight size={16} style={{ opacity: 0.4 }} />
              </Link>
            ))}
          </div>
        )}
      </header>

      <style jsx global>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-nav-btn { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-nav-dropdown { display: none !important; }
        }
      `}</style>
    </>
  );
}
