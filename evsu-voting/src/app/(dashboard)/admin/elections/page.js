"use client";

import { useEffect, useState } from "react";
import ElectionCard from "@/components/ElectionCard";


const INITIAL_FORM = {
  title: "",
  description: "",
  type: "government",
  status: "draft",
  voter_scope: "everyone",
  start_date: "",
  end_date: "",
  organization_id: "",
};

export default function AdminElectionsPage() {
  const [elections, setElections] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState("");

  const loadData = async () => {
    try {
      const res = await fetch("/api/elections");
      const data = await res.json();
      setElections(data.elections || []);
      setOrganizations(data.organizations || []);
    } catch {}
  };

  useEffect(() => {
    // Initial async load for elections and organizations.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  const createElection = async (event) => {
    event.preventDefault();

    try {
      const res = await fetch("/api/elections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          type: form.type,
          status: form.status,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          organization_id: form.voter_scope === "organization" ? form.organization_id || null : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Failed to create election.");
        return;
      }

      setStatus("Election created.");
      setForm(INITIAL_FORM);
      await loadData();
    } catch {
      setStatus("Unable to create election.");
    }
  };

  return (
    <section className="page-stack">
      <div className="page-header">
        <h1>Elections</h1>
        <p>Create and manage government, policy, and organization elections.</p>
      </div>

      <form className="glass-card form-grid" onSubmit={createElection}>
        <div className="form-group">
          <label className="form-label" htmlFor="title">Title</label>
          <input id="title" className="form-input" value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} required />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="description">Description</label>
          <textarea id="description" className="form-input" value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} rows={3} />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="type">Type</label>
          <select
            id="type"
            className="form-select"
            value={form.type}
            onChange={(event) => setForm((previous) => {
              const nextType = event.target.value;
              if (nextType === "organization" && previous.voter_scope === "everyone") {
                return { ...previous, type: nextType, voter_scope: "organization" };
              }
              return { ...previous, type: nextType };
            })}
          >
            <option value="government">Government</option>
            <option value="policy">Policy</option>
            <option value="organization">Organization</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="status">Status</label>
          <select id="status" className="form-select" value={form.status} onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value }))}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="voter-scope">Who Can Vote</label>
          <select
            id="voter-scope"
            className="form-select"
            value={form.voter_scope}
            onChange={(event) => setForm((previous) => ({ ...previous, voter_scope: event.target.value }))}
          >
            <option value="everyone">Everyone</option>
            <option value="organization">Specific Organization</option>
          </select>
        </div>

        {form.voter_scope === "organization" ? (
          <div className="form-group">
            <label className="form-label" htmlFor="org">Eligible Organization</label>
            <select id="org" className="form-select" value={form.organization_id} onChange={(event) => setForm((previous) => ({ ...previous, organization_id: event.target.value }))} required>
              <option value="">Select organization</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>{organization.name}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="form-group">
          <label className="form-label" htmlFor="start">Start Date</label>
          <input id="start" className="form-input" type="datetime-local" value={form.start_date} onChange={(event) => setForm((previous) => ({ ...previous, start_date: event.target.value }))} />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="end">End Date</label>
          <input id="end" className="form-input" type="datetime-local" value={form.end_date} onChange={(event) => setForm((previous) => ({ ...previous, end_date: event.target.value }))} />
        </div>

        <div className="button-row">
          <button type="submit" className="btn btn-primary">Create Election</button>
          {status ? <p>{status}</p> : null}
        </div>
      </form>

      <div className="grid-cards">
        {elections.map((election) => (
          <ElectionCard key={election.id} election={election} role="admin" />
        ))}
      </div>
    </section>
  );
}
