"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "../auth.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error || "Unable to send reset email right now.");
        setLoading(false);
        return;
      }

      setNotice(payload.message || "If an account exists for that email, a reset link has been sent.");
    } catch {
      setError("Unable to send reset email right now.");
    }

    setLoading(false);
  };

  return (
    <section className={styles.authCard}>
      <div className={styles.header}>
        <h1>Forgot Password</h1>
        <p>Enter your account email and we will send you a password reset link.</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="email">Email</label>
          <input
            id="email"
            className="form-input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {notice ? <p className="alert info">{notice}</p> : null}

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Sending reset email..." : "Send Reset Email"}
        </button>
      </form>

      <p className={styles.footer}>
        Remembered your password? <Link href="/login">Go back to login</Link>
      </p>
    </section>
  );
}