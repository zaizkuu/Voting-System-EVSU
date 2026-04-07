"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../auth.module.css";

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

  const updateField = (name, value) => {
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("student_id, full_name, email, is_registered")
      .eq("student_id", form.studentId.trim())
      .maybeSingle();

    if (studentError) {
      setError(studentError.message);
      setLoading(false);
      return;
    }

    if (!student) {
      setError("Error: Invalid Student ID");
      setLoading(false);
      return;
    }

    if (student.is_registered) {
      setError("This Student ID is already registered");
      setLoading(false);
      return;
    }

    if (student.full_name.toLowerCase() !== form.fullName.trim().toLowerCase()) {
      setError("Full name does not match student records");
      setLoading(false);
      return;
    }

    if (student.email && student.email.toLowerCase() !== form.email.trim().toLowerCase()) {
      setError("Email does not match student records");
      setLoading(false);
      return;
    }

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
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

    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      student_id: student.student_id,
      full_name: student.full_name,
      email: form.email.trim().toLowerCase(),
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
          <input id="password" className="form-input" type="password" value={form.password} onChange={(event) => updateField("password", event.target.value)} minLength={8} required />
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
