"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "../auth.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verified = params.get("verified");
    const reset = params.get("reset");
    const confirmationError = params.get("error");

    queueMicrotask(() => {
      if (verified === "1") {
        setNotice("Email confirmed. You can now sign in.");
        setError("");
        return;
      }

      if (reset === "1") {
        setNotice("Password reset complete. You can now sign in with your new password.");
        setError("");
        return;
      }

      if (confirmationError === "confirmation_failed" || confirmationError === "invalid_token") {
        setError("Confirmation link is invalid or expired. Try registering again.");
      }
    });
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed.");
        if (data.canResend) {
          setNotice("Check your inbox for the verification email, or register again.");
        }
        setLoading(false);
        return;
      }

      router.push(data.role === "admin" ? "/admin" : "/student");
      router.refresh();
    } catch {
      setError("Unable to process login right now.");
      setLoading(false);
    }
  };

  return (
    <section className={styles.authCard}>
      <div className={styles.header}>
        <h1>Welcome Back</h1>
        <p>Sign in to access the EVSU Voting System.</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="email">Email</label>
          <input id="email" className="form-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">Password</label>
          <div className="password-input-wrap">
            <input
              id="password"
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

        <p className="form-helper-row">
          <Link href="/forgot-password" className="form-helper-link">Forgot password?</Link>
        </p>

        {error ? <p className="form-error">{error}</p> : null}
        {notice ? <p className="alert info">{notice}</p> : null}

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>

      <p className={styles.footer}>
        New student? <Link href="/register">Create an account</Link>
      </p>
    </section>
  );
}
