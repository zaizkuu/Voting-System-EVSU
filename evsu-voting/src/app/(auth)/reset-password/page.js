"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "../auth.module.css";

function maskEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  const [localPart, domainPart] = email.split("@");

  if (!localPart || !domainPart) {
    return "your email";
  }

  const visibleStart = localPart.slice(0, 2);
  const visibleEnd = localPart.slice(-1);
  const maskedMiddle = "*".repeat(Math.max(2, localPart.length - 3));

  return `${visibleStart}${maskedMiddle}${visibleEnd}@${domainPart}`;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setResendCooldown((previous) => (previous > 0 ? previous - 1 : 0));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [resendCooldown]);

  const sendOtp = async (token, isAutomatic = false) => {
    if (!token) {
      setError("Reset session is missing. Request a new reset email.");
      return;
    }

    setSendingOtp(true);
    setError("");

    if (!isAutomatic) {
      setNotice("");
    }

    try {
      const response = await fetch("/api/auth/reset-password/otp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error || "Unable to send OTP right now.");
        setSendingOtp(false);
        return;
      }

      setOtpSent(true);
      setOtpVerified(false);
      setOtp("");
      setResendCooldown(45);
      setNotice(payload.message || "OTP sent. Check your email and enter the code below.");
    } catch {
      setError("Unable to send OTP right now.");
    }

    setSendingOtp(false);
  };

  const consumeRecoveryTokens = async (supabase, params) => {
    const queryType = String(params.get("type") || "").trim();
    const tokenHash =
      params.get("token_hash")
      || params.get("token")
      || params.get("confirmation_token");
    const code = params.get("code");

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const hashAccessToken = String(hashParams.get("access_token") || "").trim();
    const hashRefreshToken = String(hashParams.get("refresh_token") || "").trim();

    let consumed = false;
    let failed = false;

    if (hashAccessToken && hashRefreshToken) {
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: hashAccessToken,
        refresh_token: hashRefreshToken,
      });
      consumed = true;
      failed = Boolean(setSessionError);
    } else if (tokenHash) {
      const allowedTypes = new Set([
        "signup",
        "invite",
        "magiclink",
        "recovery",
        "email_change",
        "email",
      ]);

      const normalizedType = allowedTypes.has(queryType) ? queryType : "recovery";
      const { error: verifyError } = await supabase.auth.verifyOtp({
        type: normalizedType,
        token_hash: tokenHash,
      });
      consumed = true;
      failed = Boolean(verifyError);
    } else if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      consumed = true;
      failed = Boolean(exchangeError);
    }

    if (consumed) {
      const cleanedUrl = new URL(window.location.href);
      cleanedUrl.hash = "";
      cleanedUrl.searchParams.delete("code");
      cleanedUrl.searchParams.delete("token_hash");
      cleanedUrl.searchParams.delete("token");
      cleanedUrl.searchParams.delete("confirmation_token");

      if (!failed) {
        cleanedUrl.searchParams.delete("error");
      }

      window.history.replaceState({}, "", `${cleanedUrl.pathname}${cleanedUrl.search}`);
    }

    return { consumed, failed };
  };

  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;

    const checkRecoverySession = async () => {
      const params = new URLSearchParams(window.location.search);
      const recoveryError = params.get("error");

      const supabase = createClient();

      const { consumed, failed } = await consumeRecoveryTokens(supabase, params);

      let {
        data: { session },
      } = await supabase.auth.getSession();

      if ((!session?.access_token || !session?.user?.email) && consumed && !failed) {
        const {
          data: { session: retriedSession },
        } = await supabase.auth.getSession();
        session = retriedSession;
      }

      if (!session?.access_token || !session?.user?.email) {
        if (recoveryError === "recovery_link_invalid" || failed) {
          setError("This reset link is invalid or expired. Request a new password reset email.");
        } else {
          setError("This reset link is invalid or expired. Request a new one from Forgot Password.");
        }
        setHasRecoverySession(false);
        setCheckingSession(false);
        return;
      }

      setAccessToken(session.access_token);
      setRecoveryEmail(maskEmail(session.user.email));
      setHasRecoverySession(true);
      setCheckingSession(false);
      await sendOtp(session.access_token, true);
    };

    void checkRecoverySession();
  }, []);

  const handleVerifyOtp = async () => {
    if (!hasRecoverySession || !accessToken) {
      setError("Reset session is missing. Request a new reset email.");
      return;
    }

    const normalizedOtp = otp.trim();
    if (!/^\d{6}$/.test(normalizedOtp)) {
      setError("Enter the 6-digit OTP sent to your email.");
      return;
    }

    setVerifyingOtp(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/auth/reset-password/otp/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ otp: normalizedOtp }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error || "Unable to verify OTP right now.");
        setVerifyingOtp(false);
        return;
      }

      setOtpVerified(true);
      setNotice(payload.message || "OTP verified. You can now set a new password.");
    } catch {
      setError("Unable to verify OTP right now.");
    }

    setVerifyingOtp(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!hasRecoverySession) {
      setError("Reset session is missing. Request a new reset email.");
      return;
    }

    if (!otpVerified) {
      setError("Verify the OTP first before changing your password.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    const supabase = createClient();

    try {
      const response = await fetch("/api/auth/reset-password/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ password: newPassword }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error || "Unable to update password right now.");
        setLoading(false);
        return;
      }

      setNotice("Password updated successfully. Redirecting to login...");
      await supabase.auth.signOut();
      router.push("/login?reset=1");
      router.refresh();
    } catch {
      setError("Unable to process password update right now.");
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  return (
    <section className={styles.authCard}>
      <div className={styles.header}>
        <h1>Reset Password</h1>
        <p>Verify OTP first, then set a new password for your account.</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="otp">One-Time Passcode (OTP)</label>
          <input
            id="otp"
            className="form-input"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
            disabled={checkingSession || !hasRecoverySession || otpVerified}
            placeholder="Enter 6-digit OTP"
            required
          />
          {recoveryEmail ? <p>OTP was sent to {recoveryEmail}.</p> : null}
        </div>

        <div className="button-row">
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => void sendOtp(accessToken)}
            disabled={checkingSession || !hasRecoverySession || sendingOtp || resendCooldown > 0}
          >
            {sendingOtp
              ? "Sending OTP..."
              : resendCooldown > 0
                ? `Resend OTP in ${resendCooldown}s`
                : otpSent
                  ? "Resend OTP"
                  : "Send OTP"}
          </button>

          <button
            className="btn btn-outline"
            type="button"
            onClick={handleVerifyOtp}
            disabled={checkingSession || !hasRecoverySession || verifyingOtp || otpVerified || otp.trim().length !== 6}
          >
            {otpVerified ? "OTP Verified" : verifyingOtp ? "Verifying OTP..." : "Verify OTP"}
          </button>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="newPassword">New Password</label>
          <div className="password-input-wrap">
            <input
              id="newPassword"
              className="form-input with-trailing-icon"
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              autoComplete="new-password"
              disabled={checkingSession || !otpVerified || loading}
              required
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowNewPassword((previous) => !previous)}
              aria-label={showNewPassword ? "Hide new password" : "Show new password"}
              aria-pressed={showNewPassword}
            >
              {showNewPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="confirmPassword">Confirm New Password</label>
          <div className="password-input-wrap">
            <input
              id="confirmPassword"
              className="form-input with-trailing-icon"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              autoComplete="new-password"
              disabled={checkingSession || !otpVerified || loading}
              required
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowConfirmPassword((previous) => !previous)}
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              aria-pressed={showConfirmPassword}
            >
              {showConfirmPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {notice ? <p className="alert info">{notice}</p> : null}

        <button className="btn btn-primary" type="submit" disabled={loading || checkingSession || !hasRecoverySession || !otpVerified}>
          {loading ? "Updating password..." : checkingSession ? "Checking reset link..." : "Update Password"}
        </button>
      </form>

      <p className={styles.footer}>
        Need a new reset email? <Link href="/forgot-password">Forgot Password</Link>
      </p>
    </section>
  );
}