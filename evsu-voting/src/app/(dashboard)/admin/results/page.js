"use client";

import { useEffect, useState } from "react";
import Link from "next/link";


export default function AdminResultsListPage() {
  const [elections, setElections] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch("/api/elections");
        const data = await res.json();
        setElections(data.elections || []);
      } catch {}
    };
    loadData();
  }, []);

  return (
    <section className="page-stack">
      <div className="page-header">
        <h1>Election Results</h1>
        <p>Open any election to view real-time analytics and download a PDF report.</p>
      </div>

      <div className="grid-cards">
        {elections.map((election) => (
          <article className="glass-card" key={election.id}>
            <h3>{election.title}</h3>
            <p>Type: {election.type}</p>
            <p>Status: {election.status}</p>
            <Link className="btn btn-primary btn-sm" href={`/admin/results/${election.id}`}>
              Open Results
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
