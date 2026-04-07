import { ArrowUpRight } from "lucide-react";

export default function StatsCard({ label, value, hint }) {
  return (
    <article className="stats-card glass-card">
      <p className="stats-label">{label}</p>
      <h3>{value}</h3>
      <p className="stats-hint">
        <ArrowUpRight size={14} />
        {hint}
      </p>
    </article>
  );
}
