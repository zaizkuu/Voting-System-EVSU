"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import { createClient } from "@/lib/supabase/client";

const COLUMNS = [
  { key: "name", label: "Organization" },
  { key: "description", label: "Description" },
  { key: "created_at", label: "Created" },
];

export default function OrganizationsPage() {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");

  const loadRows = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("organizations").select("*").order("name", { ascending: true });
    setRows(data || []);
  };

  useEffect(() => {
    // Initial async load for organization table.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, []);

  const createOrganization = async (event) => {
    event.preventDefault();
    const supabase = createClient();

    const { error } = await supabase.from("organizations").insert({
      name,
      description,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setName("");
    setDescription("");
    setStatus("Organization created.");
    await loadRows();
  };

  return (
    <section className="page-stack">
      <div className="page-header">
        <h1>Organizations</h1>
        <p>Manage student organizations for scoped elections.</p>
      </div>

      <form className="glass-card form-grid" onSubmit={createOrganization}>
        <input className="form-input" placeholder="Organization name" value={name} onChange={(event) => setName(event.target.value)} required />
        <textarea className="form-input" placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
        <button className="btn btn-primary" type="submit">Add Organization</button>
      </form>

      {status ? <p className="alert info">{status}</p> : null}
      <DataTable columns={COLUMNS} rows={rows} />
    </section>
  );
}
