"use client";

import { User } from "lucide-react";

export default function CandidateCard({ candidate, name, defaultChecked }) {
  return (
    <label className="candidate-card glass-card" htmlFor={candidate.id}>
      <input id={candidate.id} type="radio" name={name} value={candidate.id} defaultChecked={defaultChecked} />
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        {candidate.photo_url ? (
          <img
            src={candidate.photo_url}
            alt={candidate.full_name}
            style={{
              width: 56, height: 56, borderRadius: "50%",
              objectFit: "cover", border: "3px solid var(--white)",
              boxShadow: "var(--shadow-sm)", flexShrink: 0,
            }}
          />
        ) : (
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "var(--gray-100)", border: "1px solid var(--gray-200)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <User size={22} style={{ color: "var(--gray-400)" }} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4>{candidate.full_name}</h4>
          <p>{candidate.party || "Independent"}</p>
          <small>
            {candidate.department || "Department N/A"} • Year {candidate.year_level || "N/A"}
          </small>
          {candidate.motto && (
            <p style={{ fontSize: "0.8rem", fontStyle: "italic", color: "var(--brand-gold)", fontWeight: 600, marginTop: 6 }}>
              &quot;{candidate.motto}&quot;
            </p>
          )}
          {candidate.platform ? <p className="platform">{candidate.platform}</p> : null}
        </div>
      </div>
    </label>
  );
}
