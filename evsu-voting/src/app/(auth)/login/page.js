"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../auth.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { data: profileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user?.id)
      .single();

    if (!profileData) {
      await supabase.auth.signOut();
      setError("Database error: Your account is missing a student profile. Contact admin.");
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
          <input id="password" className="form-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>

        {error ? <p className="form-error">{error}</p> : null}

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
