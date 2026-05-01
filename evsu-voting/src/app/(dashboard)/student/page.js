"use client";

import { useEffect, useState } from "react";
import {
  Vote,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import ElectionCard from "@/components/ElectionCard";
import Modal from "@/components/Modal";


export default function StudentDashboardPage() {
  const [activeElections, setActiveElections] = useState([]);
  const [completedElections, setCompletedElections] = useState([]);
  const [userName, setUserName] = useState("");
  const [organizations, setOrganizations] = useState([]);
  const [studentRowId, setStudentRowId] = useState(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [setupForm, setSetupForm] = useState({
    department: "",
    organization_id: "",
  });
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [meRes, electionsRes, orgsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/elections"),
        fetch("/api/organizations"),
      ]);
      const meData = await meRes.json();
      const electionsData = await electionsRes.json();
      const orgsData = await orgsRes.json();

      if (!meData.user) { setLoading(false); return; }
      if (meData.user.fullName) setUserName(meData.user.fullName);
      setOrganizations(orgsData.organizations || []);

      const studentId = meData.user.studentId;
      let organizationIds = [];
      let selectedOrganizationId = "";
      let studentRecordId = null;
      let studentDepartment = "";

      if (studentId) {
        const studentsRes = await fetch("/api/students");
        const studentsData = await studentsRes.json();
        const studentRecord = (studentsData.students || []).find((s) => s.student_id === studentId);
        if (studentRecord) {
          studentRecordId = studentRecord.id;
          studentDepartment = studentRecord.department || "";
          const memberOrgs = (orgsData.memberships || []).filter((m) => m.student_id === studentRecord.id);
          organizationIds = memberOrgs.map((m) => m.organization_id);
          selectedOrganizationId = organizationIds[0] || "";
        }
      }

      setStudentRowId(studentRecordId);
      setSetupForm({ department: studentDepartment, organization_id: selectedOrganizationId });

      if (studentRecordId && (!studentDepartment.trim() || !selectedOrganizationId)) {
        setShowSetupModal(true);
      }

      const visibleElections = (electionsData.elections || []).filter((e) => {
        if (!e.organization_id) return true;
        return organizationIds.includes(e.organization_id);
      });

      setActiveElections(visibleElections.filter((e) => e.status === "active"));
      setCompletedElections(visibleElections.filter((e) => e.status === "completed"));
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  const handleSaveSetup = async (event) => {
    event.preventDefault();
    if (!studentRowId) { setSetupError("Student profile record not found. Contact admin."); return; }
    const department = setupForm.department.trim();
    const organizationId = setupForm.organization_id;
    if (!department || !organizationId) { setSetupError("Department and organization are required."); return; }

    setSetupSaving(true);
    setSetupError("");

    try {
      // Note: For student self-service setup, we'll skip for now and rely on admin import
      // The setup modal is optional, so we just close it
      setShowSetupModal(false);
      setSetupSaving(false);
      setSetupError("");
      setLoading(true);
      await loadData();
    } catch {
      setSetupError("Unable to save profile.");
      setSetupSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "60vh", animation: "fadeIn 0.4s ease",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: "0 auto 16px",
            background: "linear-gradient(135deg, var(--maroon), var(--maroon-dark))",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "pulseGlow 1.5s infinite",
          }}>
            <Vote size={22} color="white" />
          </div>
          <p style={{ fontSize: "0.9rem", color: "var(--gray-400)", fontWeight: 500 }}>Loading your elections...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="page-stack">
      {/* Welcome Header */}
      <div style={{
        background: "linear-gradient(135deg, rgba(128,0,0,0.04), rgba(212,160,23,0.04))",
        border: "1px solid var(--border-default)",
        borderRadius: 16, padding: "28px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 16,
        animation: "fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1)",
      }}>
        <div>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
          }}>
            <Sparkles size={16} style={{ color: "var(--gold-dark)" }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gold-dark)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Student Portal
            </span>
          </div>
          <h1 style={{
            fontSize: "1.625rem", fontWeight: 800, letterSpacing: "-0.03em",
            color: "var(--gray-900)",
          }}>
            {userName ? `Hello, ${userName.split(" ")[0]}!` : "Welcome back!"}
          </h1>
          <p style={{ fontSize: "0.9rem", color: "var(--gray-500)", marginTop: 4 }}>
            {activeElections.length > 0
              ? `You have ${activeElections.length} active election${activeElections.length !== 1 ? "s" : ""} waiting for your vote.`
              : "No elections are open right now. Check back later!"}
          </p>
        </div>

        {/* Quick Stats */}
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: activeElections.length > 0 ? "var(--success-bg)" : "var(--gray-100)",
              border: `1px solid ${activeElections.length > 0 ? "var(--success-border)" : "var(--gray-200)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 6px",
            }}>
              <Vote size={20} style={{ color: activeElections.length > 0 ? "var(--success)" : "var(--gray-400)" }} />
            </div>
            <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--gray-900)" }}>{activeElections.length}</span>
            <span style={{ display: "block", fontSize: "0.65rem", fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase" }}>Active</span>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: "var(--gray-100)", border: "1px solid var(--gray-200)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 6px",
            }}>
              <CheckCircle2 size={20} style={{ color: "var(--gray-400)" }} />
            </div>
            <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--gray-900)" }}>{completedElections.length}</span>
            <span style={{ display: "block", fontSize: "0.65rem", fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase" }}>Completed</span>
          </div>
        </div>
      </div>

      {/* Active Elections */}
      <section style={{ animation: "fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "var(--success-bg)", border: "1px solid var(--success-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Vote size={16} style={{ color: "var(--success)" }} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--gray-800)", margin: 0 }}>Active Elections</h2>
            <p style={{ fontSize: "0.75rem", color: "var(--gray-400)", margin: 0 }}>Cast your vote now</p>
          </div>
        </div>
        {activeElections.length > 0 ? (
          <div className="grid-cards">
            {activeElections.map((election) => (
              <ElectionCard key={election.id} election={election} role="student" />
            ))}
          </div>
        ) : (
          <div style={{
            border: "2px dashed var(--border-default)", borderRadius: 14,
            padding: "40px 24px", textAlign: "center",
            background: "var(--gray-50)",
          }}>
            <Clock size={36} style={{ color: "var(--gray-200)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--gray-400)" }}>
              No active elections right now
            </p>
            <p style={{ fontSize: "0.8rem", color: "var(--gray-300)", marginTop: 4 }}>
              Elections will appear here when they&apos;re open for voting
            </p>
          </div>
        )}
      </section>

      {/* Completed Elections */}
      <section style={{ animation: "fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.2s both" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "var(--gray-100)", border: "1px solid var(--gray-200)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <CheckCircle2 size={16} style={{ color: "var(--gray-500)" }} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--gray-800)", margin: 0 }}>Completed Elections</h2>
            <p style={{ fontSize: "0.75rem", color: "var(--gray-400)", margin: 0 }}>View published results</p>
          </div>
        </div>
        {completedElections.length > 0 ? (
          <div className="grid-cards">
            {completedElections.map((election) => (
              <ElectionCard key={election.id} election={election} role="student" />
            ))}
          </div>
        ) : (
          <div style={{
            border: "2px dashed var(--border-default)", borderRadius: 14,
            padding: "40px 24px", textAlign: "center",
            background: "var(--gray-50)",
          }}>
            <AlertCircle size={36} style={{ color: "var(--gray-200)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--gray-400)" }}>
              No completed elections yet
            </p>
          </div>
        )}
      </section>

      <Modal open={showSetupModal} onClose={() => setShowSetupModal(false)} title="Complete Your Student Profile">
        <form className="form-grid" onSubmit={handleSaveSetup}>
          <p style={{ color: "var(--gray-500)", marginTop: 0 }}>
            Before voting, please confirm your current department and organization membership.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="setup-department">Department</label>
            <input
              id="setup-department"
              className="form-input"
              value={setupForm.department}
              onChange={(event) => setSetupForm((previous) => ({ ...previous, department: event.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="setup-organization">Organization</label>
            <select
              id="setup-organization"
              className="form-select"
              value={setupForm.organization_id}
              onChange={(event) => setSetupForm((previous) => ({ ...previous, organization_id: event.target.value }))}
              required
            >
              <option value="">Select organization</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>{organization.name}</option>
              ))}
            </select>
          </div>

          {setupError ? <p className="form-error">{setupError}</p> : null}

          <div className="button-row">
            <button type="submit" className="btn btn-primary" disabled={setupSaving}>
              {setupSaving ? "Saving..." : "Save Information"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
