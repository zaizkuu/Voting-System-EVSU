import { AlertTriangle, Settings, Database } from "lucide-react";

export const metadata = {
  title: "Under Maintenance | EVSU Voting",
};

export default function MaintenancePage() {
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
        <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-8"
          style={{ background: "rgba(128,0,0,0.1)", border: "2px solid rgba(128,0,0,0.2)" }}
        >
          <Settings className="h-10 w-10 animate-spin-slow" style={{ color: "#800000", animationDuration: "4s" }} />
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase mb-5"
          style={{ background: "rgba(212,160,23,0.1)", color: "#b8860b", border: "1px solid rgba(212,160,23,0.2)" }}
        >
          <AlertTriangle size={14} />
          System Offline
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight sm:text-6xl mb-6"
          style={{
            background: "linear-gradient(135deg, #800000, #a83232)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.03em",
          }}
        >
          Under Maintenance
        </h1>

        <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto leading-relaxed font-medium"
          style={{ color: "#475569" }}
        >
          The EVSU Voting System is currently undergoing emergency maintenance to resolve database connectivity issues.
        </p>

        <div className="inline-flex items-center gap-3 justify-center px-6 py-4 rounded-xl text-sm font-medium"
          style={{
            background: "rgba(255,255,255,0.8)",
            backdropFilter: "blur(8px)",
            border: "1.5px solid #e2e8f0",
            color: "#64748b",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <Database size={18} style={{ color: "#800000" }} />
          We are working to restore service as quickly as possible. Please check back later.
        </div>
      </section>
    </main>
  );
}
