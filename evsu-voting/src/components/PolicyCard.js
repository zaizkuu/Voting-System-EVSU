export default function PolicyCard({ policy }) {
  return (
    <article className="policy-card glass-card">
      <h4>{policy.title}</h4>
      <p>{policy.description || "No description provided."}</p>
      <div className="policy-vote-grid">
        <label>
          <input type="radio" name={`policy_${policy.id}`} value="yes" required /> Yes
        </label>
        <label>
          <input type="radio" name={`policy_${policy.id}`} value="no" /> No
        </label>
        <label>
          <input type="radio" name={`policy_${policy.id}`} value="abstain" /> Abstain
        </label>
      </div>
    </article>
  );
}
