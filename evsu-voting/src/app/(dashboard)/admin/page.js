"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Vote,
  CheckCircle2,
  BarChart3,
  ArrowRight,
  TrendingUp,
  Clock,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    students: 0,
    elections: 0,
    active: 0,
    votes: 0,
  });
  const [recentElections, setRecentElections] = useState([]);

  useEffect(() => {
    const loadStats = async () => {
      const supabase = createClient();

      const [students, elections, active, votes, recent] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("elections").select("id", { count: "exact", head: true }),
        supabase.from("elections").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("votes").select("id", { count: "exact", head: true }),
        supabase.from("elections").select("id, title, type, status, created_at").order("created_at", { ascending: false }).limit(5),
      ]);

      setStats({
        students: students.count || 0,
        elections: elections.count || 0,
        active: active.count || 0,
        votes: votes.count || 0,
      });
      setRecentElections(recent.data || []);
    };

    loadStats();
  }, []);

  const statCards = [
    { label: "Total Students", value: stats.students, icon: Users, color: "#6366f1", bg: "rgba(99,102,241,0.08)", hint: "Imported records" },
    { label: "Elections", value: stats.elections, icon: Vote, color: "var(--maroon)", bg: "var(--maroon-subtle)", hint: "All configured" },
    { label: "Active Now", value: stats.active, icon: Zap, color: "#059669", bg: "rgba(5,150,105,0.08)", hint: "Open for voting" },
    { label: "Total Votes", value: stats.votes, icon: BarChart3, color: "var(--gold-dark)", bg: "var(--gold-subtle)", hint: "Across all elections" },
  ];

  const quickActions = [
    { label: "Create Election", href: "/admin/elections", icon: Vote, desc: "Set up a new election" },
    { label: "Import Students", href: "/admin/students", icon: Users, desc: "Upload Excel records" },
    { label: "View Results", href: "/admin/results", icon: BarChart3, desc: "Analytics & PDF reports" },
  ];

  const statusColors = {
    draft: { bg: "var(--gray-100)", color: "var(--gray-600)", border: "var(--gray-200)" },
    active: { bg: "var(--success-bg)", color: "var(--success)", border: "var(--success-border)" },
    completed: { bg: "var(--gray-100)", color: "var(--gray-700)", border: "var(--gray-300)" },
  };

  return (
    <section className="page-stack">
      {/* Header with welcome */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        flexWrap: "wrap", gap: 16, paddingBottom: 20,
        borderBottom: "1px solid var(--border-default)",
      }}>
        <div>
          <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--maroon)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
            Admin Dashboard
          </p>
          <h1 style={{
            fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.03em",
            background: "linear-gradient(135deg, var(--gray-900), var(--gray-600))",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Welcome back 👋
          </h1>
          <p style={{ fontSize: "0.9rem", color: "var(--gray-500)", marginTop: 4 }}>
            Here&apos;s an overview of your voting platform.
          </p>
        </div>
        <Link href="/admin/elections" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "10px 20px", borderRadius: 10,
          background: "linear-gradient(135deg, var(--maroon), var(--maroon-dark))",
          color: "white", fontSize: "0.85rem", fontWeight: 600,
          textDecoration: "none", boxShadow: "0 4px 12px rgba(128,0,0,0.2)",
          transition: "all 0.2s ease",
        }}>
          <Vote size={16} />
          New Election
        </Link>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16,
      }}>
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <article key={card.label} style={{
              background: "var(--gradient-card)", backdropFilter: "blur(12px)",
              border: "1px solid var(--border-default)", borderRadius: 14,
              padding: "22px 24px", position: "relative", overflow: "hidden",
              boxShadow: "var(--shadow-sm)",
              animation: `fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.08}s both`,
              transition: "all 0.25s ease",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 11,
                  background: card.bg, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={20} style={{ color: card.color }} />
                </div>
                <TrendingUp size={16} style={{ color: "var(--success)", opacity: 0.6 }} />
              </div>
              <h3 style={{ fontSize: "1.875rem", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--gray-900)", lineHeight: 1 }}>
                {card.value}
              </h3>
              <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--gray-500)", marginTop: 6 }}>
                {card.label}
              </p>
              <p style={{ fontSize: "0.7rem", color: "var(--gray-400)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                {card.hint}
              </p>
            </article>
          );
        })}
      </div>

      {/* Two-column layout: Quick Actions + Recent Elections */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20,
      }} className="dashboard-two-col">
        {/* Quick Actions */}
        <div style={{
          background: "var(--gradient-card)", backdropFilter: "blur(12px)",
          border: "1px solid var(--border-default)", borderRadius: 14,
          padding: 0, overflow: "hidden", boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{
            padding: "18px 24px", borderBottom: "1px solid var(--border-default)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Zap size={16} style={{ color: "var(--gold-dark)" }} />
            <h3 style={{ fontSize: "0.925rem", fontWeight: 700, color: "var(--gray-800)" }}>Quick Actions</h3>
          </div>
          <div style={{ padding: 8 }}>
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.href} href={action.href} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 16px", borderRadius: 10,
                  textDecoration: "none", transition: "all 0.2s ease",
                  color: "var(--text-primary)",
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 9,
                    background: "var(--maroon-subtle)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Icon size={17} style={{ color: "var(--maroon)" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--gray-800)" }}>{action.label}</span>
                    <span style={{ display: "block", fontSize: "0.75rem", color: "var(--gray-400)" }}>{action.desc}</span>
                  </div>
                  <ArrowRight size={16} style={{ color: "var(--gray-300)" }} />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Elections */}
        <div style={{
          background: "var(--gradient-card)", backdropFilter: "blur(12px)",
          border: "1px solid var(--border-default)", borderRadius: 14,
          padding: 0, overflow: "hidden", boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{
            padding: "18px 24px", borderBottom: "1px solid var(--border-default)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={16} style={{ color: "var(--gray-400)" }} />
              <h3 style={{ fontSize: "0.925rem", fontWeight: 700, color: "var(--gray-800)" }}>Recent Elections</h3>
            </div>
            <Link href="/admin/elections" style={{
              fontSize: "0.75rem", fontWeight: 600, color: "var(--maroon)", textDecoration: "none",
            }}>View all →</Link>
          </div>
          <div style={{ padding: 8 }}>
            {recentElections.length === 0 && (
              <div style={{ padding: "32px 16px", textAlign: "center" }}>
                <Vote size={32} style={{ color: "var(--gray-200)", margin: "0 auto 12px" }} />
                <p style={{ fontSize: "0.85rem", color: "var(--gray-400)" }}>No elections created yet</p>
                <Link href="/admin/elections" style={{
                  display: "inline-block", marginTop: 12,
                  fontSize: "0.8rem", fontWeight: 600, color: "var(--maroon)", textDecoration: "none",
                }}>Create your first election →</Link>
              </div>
            )}
            {recentElections.map((election) => {
              const sc = statusColors[election.status] || statusColors.draft;
              return (
                <Link key={election.id} href={`/admin/elections/${election.id}`} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", borderRadius: 10,
                  textDecoration: "none", transition: "all 0.2s ease",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: "0.85rem", fontWeight: 600, color: "var(--gray-800)",
                      display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{election.title}</span>
                    <span style={{ fontSize: "0.7rem", color: "var(--gray-400)", textTransform: "capitalize" }}>
                      {election.type}
                    </span>
                  </div>
                  <span style={{
                    fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.05em", padding: "3px 10px", borderRadius: 99,
                    background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                    flexShrink: 0,
                  }}>
                    {election.status}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 768px) {
          .dashboard-two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
