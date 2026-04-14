"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff } from "lucide-react";
import styles from "../auth.module.css";

function parseOrigin(value) {
  try {
    return new URL(String(value || "").trim()).origin;
  } catch {
    return null;
  }
}

function isLocalhostOrigin(origin) {
  try {
    const hostname = new URL(origin).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

function resolvePublicAppOrigin() {
  const envOrigin = parseOrigin(process.env.NEXT_PUBLIC_APP_URL);
  const browserOrigin = parseOrigin(window.location.origin);

  if (envOrigin && !isLocalhostOrigin(envOrigin)) {
    return envOrigin;
  }

  if (browserOrigin) {
    return browserOrigin;
  }

  return envOrigin || "";
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    studentId: "",
    fullName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const updateField = (name, value) => {
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const sendRegistrationConfirmationEmail = async ({ userId, email, fullName }) => {
    try {
      await fetch("/api/auth/register-confirmation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          email,
          fullName,
        }),
      });
    } catch {
      // Registration should not fail when confirmation email delivery fails.
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const normalizedStudentId = form.studentId.trim();
    const normalizedEmail = form.email.trim().toLowerCase();
    const normalizedFullName = form.fullName.trim();

    // Use SECURITY DEFINER RPC so registration can validate student IDs without exposing table reads to anon users.
    const { data: validationResult, error: validationError } = await supabase
      .rpc("validate_student_id", { p_student_id: normalizedStudentId });

    if (validationError) {
      setError("Unable to validate student records right now. Please try again.");
      setLoading(false);
      return;
    }

    if (!validationResult?.valid) {
      setError(validationResult?.error || "Error: Invalid Student ID");
      setLoading(false);
      return;
    }

    const profileFullName = String(validationResult.full_name || normalizedFullName || "").trim();
    // Let Supabase verify first, then redirect directly to login.
    const emailRedirectTo = `${resolvePublicAppOrigin()}/login?verified=1`;

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: form.password,
      options: {
        emailRedirectTo,
        data: {
          student_id: normalizedStudentId,
          full_name: profileFullName,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!authData.user?.id) {
      setError("Account created. Please verify your email then login.");
      setLoading(false);
      return;
    }

    void sendRegistrationConfirmationEmail({
      userId: authData.user.id,
      email: normalizedEmail,
      fullName: profileFullName,
    });

    // With email confirmation enabled, there may be no active session yet.
    // In that case we defer profile creation until first successful login.
    if (!authData.session) {
      setError("Account created. Please verify your email and sign in to complete setup.");
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      student_id: normalizedStudentId,
      full_name: profileFullName,
      email: normalizedEmail,
      role: "student",
    });

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    router.push("/student");
    router.refresh();
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
