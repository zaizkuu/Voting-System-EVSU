import Link from "next/link";
import { Shield, Building2, Vote } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #fef9f0 0%, #fdf2f8 40%, #f0f4ff 100%)" }}
    >
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-30 pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(128,0,0,0.08) 0%, transparent 70%)", transform: "translate(30%, -30%)" }}
      />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-30 pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(212,160,23,0.08) 0%, transparent 70%)", transform: "translate(-30%, 30%)" }}
      />

      <section className="text-center max-w-3xl mx-auto mb-16 relative z-10"
        style={{ animation: "fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase mb-5"
          style={{ background: "rgba(128,0,0,0.06)", color: "#800000", border: "1px solid rgba(128,0,0,0.12)" }}
        >
          <Vote size={14} />
          Eastern Visayas State University
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight sm:text-6xl mb-6"
          style={{
            background: "linear-gradient(135deg, #800000, #a83232)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.03em",
          }}
        >
          EVSU Voting System
        </h1>
        <p className="text-lg mb-8 max-w-2xl mx-auto leading-relaxed"
          style={{ color: "#64748b" }}
        >
          A secure, trustworthy platform for Student Government Elections, Policy Voting, and
          Organization Elections.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/login" className="inline-flex items-center justify-center px-7 py-3.5 text-base font-semibold rounded-xl text-white transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: "linear-gradient(135deg, #800000, #5c0000)",
              boxShadow: "0 4px 14px rgba(128,0,0,0.25), 0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            Login
          </Link>
          <Link href="/register" className="inline-flex items-center justify-center px-7 py-3.5 text-base font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: "rgba(255,255,255,0.8)",
              backdropFilter: "blur(8px)",
              border: "1.5px solid #e2e8f0",
              color: "#334155",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            Register
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full relative z-10">
        {[
          { icon: Shield, title: "Government Elections", desc: "Elect official student leaders by position with one-vote safeguards.", delay: "0.15s" },
          { icon: Vote, title: "Policy Voting", desc: "Vote Yes, No, or Abstain on policy items and campus proposals.", delay: "0.25s" },
          { icon: Building2, title: "Organization Elections", desc: "Run member-only elections for recognized student organizations.", delay: "0.35s" },
        ].map(({ icon: Icon, title, desc, delay }) => (
          <article key={title} className="rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1 group"
            style={{
              background: "rgba(255,255,255,0.75)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(226,232,240,0.8)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              animation: `fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay} both`,
            }}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
              style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.15)" }}
            >
              <Icon className="h-5 w-5" style={{ color: "#b8860b" }} />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: "#0f172a" }}>{title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>{desc}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
