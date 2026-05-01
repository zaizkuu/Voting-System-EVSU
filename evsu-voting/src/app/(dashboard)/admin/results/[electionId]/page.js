"use client";

import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { FileDown } from "lucide-react";

import { generateReport } from "@/lib/pdf/generateReport";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function AdminResultsPage({ params }) {
  const { electionId } = React.use(params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [election, setElection] = useState(null);
  const [positionsData, setPositionsData] = useState([]);

  const formatStatus = (value) => {
    const text = String(value || "").trim();
    if (!text) return "Unknown";
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  useEffect(() => {
    const loadResults = async () => {
      try {
        const [electionRes, votesRes] = await Promise.all([
          fetch(`/api/elections/${electionId}`),
          fetch(`/api/elections/${electionId}/votes`),
        ]);
        const electionData = await electionRes.json();
        const votesData = await votesRes.json();

        if (!electionData.election) { setError("Election not found."); setLoading(false); return; }
        setElection(electionData.election);

        const positions = electionData.positions || [];
        const candidates = electionData.candidates || [];
        const policyOptions = electionData.policyOptions || [];
        const votes = votesData.votes || [];

        if (electionData.election.type === "policy") {
          const grouped = policyOptions.map((option) => {
            const optionVotes = votes.filter((v) => v.policy_option_id === option.id);
            const yesCount = optionVotes.filter((v) => v.policy_vote === "yes").length;
            const noCount = optionVotes.filter((v) => v.policy_vote === "no").length;
            const abstainCount = optionVotes.filter((v) => v.policy_vote === "abstain").length;
            let winnerText = "TIE / Null";
            if (yesCount > noCount) winnerText = "YES Passes";
            if (noCount > yesCount) winnerText = "NO Reject";
            return { id: option.id, title: option.title, winner: winnerText, options: [
              { label: "Yes", count: yesCount }, { label: "No", count: noCount }, { label: "Abstain", count: abstainCount },
            ]};
          });
          setPositionsData(grouped);
        } else {
          const grouped = positions.map((position) => {
            const posCandidates = candidates.filter((c) => c.position_id === position.id);
            const options = posCandidates.map((c) => ({
              label: c.full_name,
              count: votes.filter((v) => v.candidate_id === c.id).length,
            }));
            options.sort((a, b) => b.count - a.count);
            let winnerText = options[0]?.count > 0 ? options[0].label : "No Votes Cast";
            if (options.length > 1 && options[0]?.count === options[1]?.count && options[0].count > 0) winnerText = "TIE";
            return { id: position.id, title: position.title, winner: winnerText, options };
          });
          setPositionsData(grouped);
        }
      } catch { setError("Unable to load results."); }
      setLoading(false);
    };
    loadResults();
  }, [electionId]);

  const downloadPDF = () => {
    if (!election) return;

    // Calculate sum of all votes cast
    const totalVotes = positionsData.reduce((sum, position) => {
      return sum + position.options.reduce((posSum, opt) => posSum + opt.count, 0);
    }, 0);

    generateReport({
      electionTitle: election.title,
      electionType: election.type,
      electionStatus: election.status,
      reportMode: election.status === "completed" ? "Official Final Report" : "Live Snapshot Report",
      generatedAt: new Date().toLocaleString(),
      summaryRows: [
        ["Election Type", election.type.toUpperCase()],
        ["Status", election.status.toUpperCase()],
        ["Report Mode", election.status === "completed" ? "FINAL" : "LIVE SNAPSHOT"],
        ["Total Votes Cast", totalVotes.toString()],
        ["Total Sections", positionsData.length.toString()],
      ],
      positionsData,
    });
  };

  const getChartData = (options) => ({
    labels: options.map((opt) => opt.label),
    datasets: [
      {
        label: "Votes Cast",
        data: options.map((opt) => opt.count),
        backgroundColor: "rgba(128, 0, 0, 0.72)",
        borderColor: "#FFD700",
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  });

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 } },
    },
  };

  if (loading) return <p>Loading result analytics...</p>;
  if (error) return <p className="alert error">{error}</p>;

  return (
    <section className="page-stack">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1>{election.title}</h1>
          <p>
            Real-time election analytics and downloadable report export.
            {election.status !== "completed" ? " PDF is generated as a live snapshot." : " PDF is marked as final."}
          </p>
          <p className="badge" style={{ width: "fit-content", marginTop: 8 }}>
            Status: {formatStatus(election.status)}
          </p>
        </div>
        <button type="button" className="btn btn-gold" onClick={downloadPDF} style={{ whiteSpace: "nowrap" }}>
          <FileDown size={16} />
          Download PDF Report
        </button>
      </div>

      <div className="analytics-grid" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        {positionsData.map((position) => (
          <div key={position.id} style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "24px", alignItems: "start" }}>
            
            <div className="glass-card" style={{ padding: "24px" }}>
              <h3 style={{ marginBottom: "16px", color: "var(--maroon)", fontSize: "1.2rem", borderBottom: "1px solid var(--border-default)", paddingBottom: "12px" }}>
                {position.title} 
              </h3>
              <div style={{ height: "300px", width: "100%" }}>
                <Bar data={getChartData(position.options)} options={chartOptions} />
              </div>
            </div>

            <div className="glass-card" style={{ padding: "20px" }}>
              <h4 style={{ fontSize: "0.9rem", color: "var(--gray-500)", textTransform: "uppercase", marginBottom: "12px" }}>Leaderboard</h4>
              
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                {position.options.map((opt, i) => (
                  <li key={opt.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
                    <span style={{ fontWeight: i === 0 && opt.count > 0 ? 700 : 500, color: i === 0 && opt.count > 0 ? "var(--maroon)" : "inherit" }}>
                      {i + 1}. {opt.label}
                    </span>
                    <span style={{ fontWeight: 700, background: "var(--gray-100)", padding: "2px 8px", borderRadius: "12px", fontSize: "0.85rem" }}>
                      {opt.count}
                    </span>
                  </li>
                ))}
              </ul>

              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "2px dashed var(--gray-200)" }}>
                <span style={{ display: "block", fontSize: "0.8rem", color: "var(--gray-500)", marginBottom: "4px" }}>CURRENT LEADER / WINNER</span>
                <span style={{ display: "block", fontWeight: 700, color: "var(--gold-dark)", fontSize: "1.1rem" }}>{position.winner}</span>
              </div>
            </div>
            
          </div>
        ))}

        {positionsData.length === 0 && (
          <div className="glass-card" style={{ textAlign: "center", padding: "40px" }}>
            <p>No candidates or positions found for this election.</p>
          </div>
        )}
      </div>
    </section>
  );
}
