"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AdminResultsListPage() {
  const [elections, setElections] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("elections")
        .select("id, title, type, status")
        .eq("status", "completed")
        .order("end_date", { ascending: false });

      setElections(data || []);
    };

    loadData();
  }, []);

  return (
    <section className="page-stack">
      <div className="page-header">
        <h1>Election Results</h1>
        <p>Select a completed election to view charts and export PDF reports.</p>
      </div>

      <div className="grid-cards">
        {elections.map((election) => (
          <article className="glass-card" key={election.id}>
            <h3>{election.title}</h3>
            <p>Type: {election.type}</p>
            <Link className="btn btn-primary btn-sm" href={`/admin/results/${election.id}`}>
              Open Results
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
