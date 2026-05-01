"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Shield } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed.");
        setLoading(false);
        return;
      }

      if (data.role !== "admin") {
        await fetch("/api/auth/logout", { method: "POST" });
        setError("Access denied. This login is for administrators only.");
        setLoading(false);
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Unable to process login right now.");
      setLoading(false);
    }
  };

  return (
    <main className="auth-layout">
      <section style={{
        width: "min(100%, 460px)",
        padding: "36px",
        borderRadius: "var(--radius-xl)",
        background: "var(--gradient-card)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid var(--border-default)",
        boxShadow: "var(--shadow-xl)",
        position: "relative",
        zIndex: 1,
        animation: "fadeInUp var(--duration-slow) var(--ease-out)",
      }}>
        <div style={{ marginBottom: "24px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "4px 12px",
            borderRadius: "var(--radius-full)",
            background: "var(--maroon-subtle)",
            border: "1px solid rgba(128,0,0,0.12)",
            marginBottom: "16px",
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "var(--maroon)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            <Shield size={14} />
            Administrator
          </div>
          <h1 style={{
            fontSize: "1.625rem",
            background: "linear-gradient(135deg, var(--maroon), var(--maroon-light))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>Admin Login</h1>
          <p style={{ marginTop: "6px", fontSize: "0.9rem", color: "var(--gray-500)" }}>
            Sign in with your administrator credentials.
          </p>
        </div>

        <form style={{ display: "grid", gap: "16px" }} onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              className="form-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="admin-password">Password</label>
            <div className="password-input-wrap">
              <input
                id="admin-password"
                className="form-input with-trailing-icon"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((previous) => !previous)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {error ? <p className="form-error">{error}</p> : null}

          <p className="form-helper-row" style={{ justifyContent: "flex-end" }}>
            <Link href="/forgot-password" className="form-helper-link">Forgot password?</Link>
          </p>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in as Admin"}
          </button>
        </form>
      </section>
    </main>
  );
}
