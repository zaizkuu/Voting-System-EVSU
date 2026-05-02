"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CandidateCard from "@/components/CandidateCard";
import PolicyCard from "@/components/PolicyCard";


export default function VotePage({ params }) {
  const { electionId } = React.use(params);
  const router = useRouter();

  const [election, setElection] = useState(null);
  const [positions, setPositions] = useState([]);
  const [candidatesByPosition, setCandidatesByPosition] = useState({});
  const [policyOptions, setPolicyOptions] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [status, setStatus] = useState({ loading: true, error: "", message: "" });

  useEffect(() => {
    const loadElection = async () => {
      try {
        const [meRes, electionRes, votesRes, orgsRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch(`/api/elections/${electionId}`),
          fetch(`/api/elections/${electionId}/votes`),
          fetch("/api/organizations"),
        ]);
        const meData = await meRes.json();
        const electionData = await electionRes.json();
        const votesData = await votesRes.json();
        const orgsData = await orgsRes.json();

        if (!meData.user) { router.push("/login"); return; }
        if (!electionData.election) { setStatus({ loading: false, error: "Election not found.", message: "" }); return; }
        if (electionData.election.status !== "active") { setStatus({ loading: false, error: "This election is not active.", message: "" }); return; }

        // Eligibility check for org-scoped elections
        if (electionData.election.organization_id) {
          let isEligible = false;
          if (meData.user.studentId) {
            const myProfileRes = await fetch("/api/students/me");
            const myProfileData = await myProfileRes.json();
            if (myProfileData.student) {
              isEligible = (myProfileData.organizationIds || []).includes(electionData.election.organization_id);
            }
          }
          if (!isEligible) { setStatus({ loading: false, error: "This election is restricted to a specific organization.", message: "" }); return; }
        }

        if (votesData.hasVoted) setHasVoted(true);
        setElection(electionData.election);

        if (electionData.election.type === "policy") {
          setPolicyOptions(electionData.policyOptions || []);
        } else {
          setPositions(electionData.positions || []);
          const grouped = (electionData.candidates || []).reduce((acc, c) => {
            (acc[c.position_id] = acc[c.position_id] || []).push(c);
            return acc;
          }, {});
          setCandidatesByPosition(grouped);
        }
        setStatus({ loading: false, error: "", message: "" });
      } catch { setStatus({ loading: false, error: "Unable to load election.", message: "" }); }
    };
    loadElection();
  }, [electionId, router]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (!election) return;

    let rows = [];
    if (election.type === "policy") {
      rows = policyOptions.map((option) => ({
        policy_option_id: option.id,
        policy_vote: String(formData.get(`policy_${option.id}`)),
      }));
    } else {
      rows = positions.map((position) => {
        const candidateId = formData.get(`position_${position.id}`);
        if (!candidateId) return null;
        return { position_id: position.id, candidate_id: String(candidateId) };
      }).filter(Boolean);

      if (rows.length !== positions.length) {
        setStatus({ loading: false, error: "Please vote for all positions.", message: "" });
        return;
      }
    }

    try {
      const res = await fetch(`/api/elections/${electionId}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votes: rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ loading: false, error: data.error, message: "" });
        if (data.error?.includes("already")) setHasVoted(true);
        return;
      }
      setStatus({ loading: false, error: "", message: "Vote submitted successfully." });
      setHasVoted(true);
      router.push("/student");
      router.refresh();
    } catch {
      setStatus({ loading: false, error: "Unable to submit vote.", message: "" });
    }
  };

  if (status.loading) {
    return <p>Loading ballot...</p>;
  }

  if (status.error && !election) {
    return <p className="form-error">{status.error}</p>;
  }

  return (
    <section className="page-stack">
      <div className="page-header">
        <h1>{election.title}</h1>
        <p>{election.description || "Cast your vote carefully. Votes are final."}</p>
      </div>

      {hasVoted ? <p className="alert success">You already voted in this election.</p> : null}
      {status.error ? <p className="alert error">{status.error}</p> : null}
      {status.message ? <p className="alert success">{status.message}</p> : null}

      {!hasVoted ? (
        <form className="section-stack" onSubmit={handleSubmit}>
          {election.type === "policy"
            ? policyOptions.map((policy) => <PolicyCard key={policy.id} policy={policy} />)
            : positions.map((position) => (
                <section className="section-stack" key={position.id}>
                  <h3>{position.title}</h3>
                  <div className="grid-cards">
                    {(candidatesByPosition[position.id] || []).map((candidate) => (
                      <CandidateCard
                        key={candidate.id}
                        candidate={candidate}
                        name={`position_${position.id}`}
                      />
                    ))}
                  </div>
                </section>
              ))}

          <button type="submit" className="btn btn-primary">
            Submit Vote
          </button>
        </form>
      ) : null}
    </section>
  );
}
