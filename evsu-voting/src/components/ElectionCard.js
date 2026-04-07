import Link from "next/link";

export default function ElectionCard({ election, role = "student" }) {
  const isCompleted = election.status === "completed";
  const isDraft = election.status === "draft";

  return (
    <article className="election-card glass-card">
      <div className="election-card-head">
        <span className={`badge badge-${election.type}`}>{election.type}</span>
        <span className={`badge badge-${election.status}`}>{election.status}</span>
      </div>
      <h3>{election.title}</h3>
      <p>{election.description || "No description available."}</p>
      <div className="election-card-foot">
        {role === "admin" ? (
          <Link className="btn btn-outline btn-sm" href={`/admin/elections/${election.id}`}>
            Manage
          </Link>
        ) : null}
        {role === "student" && !isDraft ? (
          <Link
            className="btn btn-primary btn-sm"
            href={isCompleted ? `/student/results/${election.id}` : `/student/vote/${election.id}`}
          >
            {isCompleted ? "View Results" : "Vote Now"}
          </Link>
        ) : null}
      </div>
    </article>
  );
}
