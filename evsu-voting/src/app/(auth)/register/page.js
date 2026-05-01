"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "../auth.module.css";

export default function RegisterPage() {
  const [form, setForm] = useState({
    studentId: "",
    fullName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const updateField = (name, value) => {
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: form.studentId.trim(),
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Registration failed.");
        setLoading(false);
        return;
      }

      setNotice(data.message || "Account created. Please verify your email and sign in.");
      setLoading(false);
    } catch {
      setError("Unable to create account right now.");
      setLoading(false);
    }
  };

  return (
    <section className={styles.authCard}>
      <div className={styles.header}>
        <h1>Create Student Account</h1>
        <p>Register using your official student records.</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="studentId">Student ID</label>
          <input id="studentId" className="form-input" placeholder="e.g. 2021-12345" autoComplete="off" value={form.studentId} onChange={(event) => updateField("studentId", event.target.value)} required />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="fullName">Full Name</label>
          <input id="fullName" className="form-input" value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} required />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="email">Email</label>
          <input id="email" className="form-input" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} required />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">Password</label>
          <div className="password-input-wrap">
            <input
              id="password"
              className="form-input with-trailing-icon"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              minLength={8}
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
        {notice ? <p className="alert info">{notice}</p> : null}

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Register"}
        </button>
      </form>

      <p className={styles.footer}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </section>
  );
}
