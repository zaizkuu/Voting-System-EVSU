export default function CandidateCard({ candidate, name, defaultChecked }) {
  return (
    <label className="candidate-card glass-card" htmlFor={candidate.id}>
      <input id={candidate.id} type="radio" name={name} value={candidate.id} defaultChecked={defaultChecked} />
      <div>
        <h4>{candidate.full_name}</h4>
        <p>{candidate.party || "Independent"}</p>
        <small>
          {candidate.department || "Department N/A"} • Year {candidate.year_level || "N/A"}
        </small>
        {candidate.platform ? <p className="platform">{candidate.platform}</p> : null}
      </div>
    </label>
  );
}
