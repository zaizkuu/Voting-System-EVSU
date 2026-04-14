"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setupStudentId, setSetupStudentId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [repairingSetup, setRepairingSetup] = useState(false);
  const [canResendVerification, setCanResendVerification] = useState(false);
  const [showSetupRecovery, setShowSetupRecovery] = useState(false);
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
        setCanResendVerification(false);
        setShowSetupRecovery(false);
        return;
      }

      if (reset === "1") {
        setNotice("Password reset complete. You can now sign in with your new password.");
        setError("");
        setCanResendVerification(false);
        setShowSetupRecovery(false);
        return;
      }

      if (confirmationError === "confirmation_failed" || confirmationError === "confirmation_link_invalid") {
        setError("Confirmation link is invalid or expired. Request a new verification email.");
        setCanResendVerification(true);
        setShowSetupRecovery(false);
      }
    });
  }, []);

  const handleResendVerification = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Enter your email first, then resend verification.");
      return;
    }

    setResending(true);
    setError("");
    setNotice("");

    const supabase = createClient();
    const emailRedirectTo = `${resolvePublicAppOrigin()}/login?verified=1`;

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: { emailRedirectTo },
    });

    if (resendError) {
      setError(resendError.message);
      setResending(false);
      return;
    }

    setNotice("Verification email resent. Check your inbox and spam, then open the newest link.");
    setCanResendVerification(false);
    setResending(false);
  };

  const handleCompleteSetup = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedStudentId = setupStudentId.trim();

    if (!normalizedEmail || !password.trim()) {
      setError("Enter your email and password first.");
      return;
    }

    if (!normalizedStudentId) {
      setError("Enter your Student ID to complete account setup.");
      return;
    }

    setRepairingSetup(true);
    setError("");
    setNotice("");

    const supabase = createClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (loginError) {
      if (loginError.message.toLowerCase().includes("not confirmed")) {
        setError("Your email is not verified yet. Request a new verification email below.");
        setCanResendVerification(true);
      } else {
        setError(loginError.message);
      }
      setRepairingSetup(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      setError("Unable to load your account session. Please try logging in again.");
      setRepairingSetup(false);
      return;
    }

    const { data: validationResult, error: validationError } = await supabase
      .rpc("validate_student_id", { p_student_id: normalizedStudentId });

    if (validationError) {
      setError("Unable to validate student records right now. Please try again.");
      setRepairingSetup(false);
      return;
    }

    if (!validationResult?.valid) {
      setError(validationResult?.error || "Error: Invalid Student ID");
      setRepairingSetup(false);
      return;
    }

    const fullName = String(validationResult.full_name || "Student").trim();
    const { error: profileInsertError } = await supabase.from("profiles").insert({
      id: user.id,
      student_id: normalizedStudentId,
      full_name: fullName,
      email: normalizedEmail,
      role: "student",
    });

    if (profileInsertError && profileInsertError.code !== "23505") {
      setError(profileInsertError.message);
      setRepairingSetup(false);
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profileData) {
      setError("Account setup could not be completed yet. Try again in a few seconds.");
      setRepairingSetup(false);
      return;
    }

    router.push(profileData.role === "admin" ? "/admin" : "/student");
    router.refresh();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    setCanResendVerification(false);
    setShowSetupRecovery(false);

    const supabase = createClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      if (loginError.message.toLowerCase().includes("not confirmed")) {
        setError("Your email is not verified yet. Request a new verification email below.");
        setCanResendVerification(true);
      } else {
        setError(loginError.message);
      }
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { data: initialProfileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user?.id)
      .maybeSingle();

    let profileData = initialProfileData;

    // If profile is missing (common when email confirmation delayed session creation),
    // try to self-heal using signup metadata once the user is authenticated.
    if (!profileData && user?.id) {
      const metaStudentId = String(user.user_metadata?.student_id || "").trim();
      const metaFullName = String(user.user_metadata?.full_name || "").trim();

      if (metaStudentId) {
        const { error: profileInsertError } = await supabase.from("profiles").insert({
          id: user.id,
          student_id: metaStudentId,
          full_name: metaFullName || "Student",
          email: String(user.email || email).trim().toLowerCase(),
          role: "student",
        });

        // Ignore duplicate insert race and continue to refetch.
        if (!profileInsertError || profileInsertError.code === "23505") {
          const { data: recoveredProfile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
          profileData = recoveredProfile;
        }
      }
    }

    if (!profileData) {
      await supabase.auth.signOut();
      setError("Your account setup is incomplete. Enter your Student ID below, then click Complete Setup.");
      setShowSetupRecovery(true);
      setLoading(false);
      return;
    }

    router.push(profileData?.role === "admin" ? "/admin" : "/student");
    router.refresh();
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

        {showSetupRecovery ? (
          <div className="form-group">
            <label className="form-label" htmlFor="setupStudentId">Student ID (for account setup)</label>
            <input
              id="setupStudentId"
              className="form-input"
              placeholder="e.g. 2021-12345"
              value={setupStudentId}
              onChange={(event) => setSetupStudentId(event.target.value)}
              required={showSetupRecovery}
            />
          </div>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}
        {notice ? <p className="alert info">{notice}</p> : null}

        {canResendVerification ? (
          <button className="btn btn-outline" type="button" onClick={handleResendVerification} disabled={loading || resending}>
            {resending ? "Resending verification..." : "Resend Verification Email"}
          </button>
        ) : null}

        {showSetupRecovery ? (
          <button className="btn btn-outline" type="button" onClick={handleCompleteSetup} disabled={loading || repairingSetup || resending}>
            {repairingSetup ? "Completing setup..." : "Complete Setup"}
          </button>
        ) : null}

        <button className="btn btn-primary" type="submit" disabled={loading || resending || repairingSetup}>
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>

      <p className={styles.footer}>
        New student? <Link href="/register">Create an account</Link>
      </p>
    </section>
  );
}
