"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CandidateCard from "@/components/CandidateCard";
import PolicyCard from "@/components/PolicyCard";
import { createClient } from "@/lib/supabase/client";

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
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: electionData, error: electionError } = await supabase
        .from("elections")
        .select("*")
        .eq("id", electionId)
        .single();

      if (electionError || !electionData) {
        setStatus({ loading: false, error: "Election not found.", message: "" });
        return;
      }

      if (electionData.status !== "active") {
        setStatus({ loading: false, error: "This election is not active.", message: "" });
        return;
      }

      const { count } = await supabase
        .from("votes")
        .select("id", { count: "exact", head: true })
        .eq("election_id", electionId)
        .eq("voter_id", user.id);

      if ((count || 0) > 0) {
        setHasVoted(true);
      }

      setElection(electionData);

      if (electionData.type === "policy") {
        const { data: options } = await supabase
          .from("policy_options")
          .select("*")
          .eq("election_id", electionId)
          .order("display_order", { ascending: true });

        setPolicyOptions(options || []);
      } else {
        const { data: positionsData } = await supabase
          .from("positions")
          .select("*")
          .eq("election_id", electionId)
          .order("display_order", { ascending: true });

        const { data: candidatesData } = await supabase
          .from("candidates")
          .select("*")
          .eq("election_id", electionId);

        const grouped = (candidatesData || []).reduce((accumulator, candidate) => {
          const list = accumulator[candidate.position_id] || [];
          list.push(candidate);
          accumulator[candidate.position_id] = list;
          return accumulator;
        }, {});

        setPositions(positionsData || []);
        setCandidatesByPosition(grouped);
      }

      setStatus({ loading: false, error: "", message: "" });
    };

    loadElection();
  }, [electionId, router]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    // Extract formData synchronously before any awaits
    const formData = new FormData(event.currentTarget);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !election) return;

    const { count } = await supabase
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("election_id", electionId)
      .eq("voter_id", user.id);

    if ((count || 0) > 0) {
      setStatus({ loading: false, error: "You already submitted your vote.", message: "" });
      setHasVoted(true);
      return;
    }

    if (election.type === "policy") {
      const rows = policyOptions.map((option) => ({
        election_id: electionId,
        policy_option_id: option.id,
        policy_vote: String(formData.get(`policy_${option.id}`)),
        voter_id: user.id,
      }));

      const { error } = await supabase.from("votes").insert(rows);
      if (error) {
        setStatus({ loading: false, error: error.message, message: "" });
        return;
      }
    } else {
      const rows = positions
        .map((position) => {
          const candidateId = formData.get(`position_${position.id}`);
          if (!candidateId) return null;
          return {
            election_id: electionId,
            position_id: position.id,
            candidate_id: String(candidateId),
            voter_id: user.id,
          };
        })
        .filter(Boolean);

      if (rows.length !== positions.length) {
        setStatus({ loading: false, error: "Please vote for all positions.", message: "" });
        return;
      }

      const { error } = await supabase.from("votes").insert(rows);
      if (error) {
        setStatus({ loading: false, error: error.message, message: "" });
        return;
      }
    }

    setStatus({ loading: false, error: "", message: "Vote submitted successfully." });
    setHasVoted(true);
    router.push(`/student`);
    router.refresh();
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
