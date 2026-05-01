"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "../auth.module.css";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [hasValidToken, setHasValidToken] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const intervalId = setInterval(() => {
      setResendCooldown((previous) => (previous > 0 ? previous - 1 : 0));
    }, 1000);
    return () => clearInterval(intervalId);
  }, [resendCooldown]);

  const sendOtp = async (token) => {
    if (!token) {
      setError("Reset token is missing. Request a new reset email.");
      return;
    }

    setSendingOtp(true);
    setError("");

    try {
      const response = await fetch("/api/auth/reset-password/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
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

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setError("This reset link is invalid or expired. Request a new one from Forgot Password.");
      setCheckingToken(false);
      return;
    }

    setResetToken(token);
    setHasValidToken(true);
    setCheckingToken(false);
    void sendOtp(token);
  }, []);

  const handleVerifyOtp = async () => {
    if (!hasValidToken || !resetToken) {
      setError("Reset token is missing. Request a new reset email.");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, otp: normalizedOtp }),
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

    if (!hasValidToken) {
      setError("Reset token is missing. Request a new reset email.");
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

    try {
      const response = await fetch("/api/auth/reset-password/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password: newPassword }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "Unable to update password right now.");
        setLoading(false);
        return;
      }

      setNotice("Password updated successfully. Redirecting to login...");
      router.push("/login?reset=1");
      router.refresh();
    } catch {
      setError("Unable to process password update right now.");
      setLoading(false);
    }
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
            disabled={checkingToken || !hasValidToken || otpVerified}
            placeholder="Enter 6-digit OTP"
            required
          />
        </div>

        <div className="button-row">
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => void sendOtp(resetToken)}
            disabled={checkingToken || !hasValidToken || sendingOtp || resendCooldown > 0}
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
            disabled={checkingToken || !hasValidToken || verifyingOtp || otpVerified || otp.trim().length !== 6}
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
              disabled={checkingToken || !otpVerified || loading}
              required
            />
            <button type="button" className="password-toggle-btn" onClick={() => setShowNewPassword((p) => !p)} aria-label={showNewPassword ? "Hide" : "Show"}>
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
              disabled={checkingToken || !otpVerified || loading}
              required
            />
            <button type="button" className="password-toggle-btn" onClick={() => setShowConfirmPassword((p) => !p)} aria-label={showConfirmPassword ? "Hide" : "Show"}>
              {showConfirmPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {notice ? <p className="alert info">{notice}</p> : null}

        <button className="btn btn-primary" type="submit" disabled={loading || checkingToken || !hasValidToken || !otpVerified}>
          {loading ? "Updating password..." : checkingToken ? "Checking reset link..." : "Update Password"}
        </button>
      </form>

      <p className={styles.footer}>
        Need a new reset email? <Link href="/forgot-password">Forgot Password</Link>
      </p>
    </section>
  );
}