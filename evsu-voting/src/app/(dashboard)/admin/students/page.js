"use client";

import { useMemo, useState } from "react";
import DataTable from "@/components/DataTable";
import FileUpload from "@/components/FileUpload";
import { createClient } from "@/lib/supabase/client";

const COLUMNS = [
  { key: "student_id", label: "Student ID" },
  { key: "full_name", label: "Full Name" },
  { key: "email", label: "Email" },
  { key: "program", label: "Program" },
  { key: "department", label: "Department" },
  { key: "year_level", label: "Year Level" },
];

export default function AdminStudentsPage() {
  const [previewRows, setPreviewRows] = useState([]);
  const [status, setStatus] = useState("");

  const importRows = async () => {
    if (!previewRows.length) return;

    setStatus("Importing records...");
    const supabase = createClient();

    const studentsPayload = previewRows.map((row) => ({
      student_id: row.student_id,
      full_name: row.full_name,
      email: row.email,
      program: row.program,
      department: row.department,
      year_level: row.year_level,
      is_registered: false,
    }));

    const { error: studentsError } = await supabase
      .from("students")
      .upsert(studentsPayload, { onConflict: "student_id", ignoreDuplicates: false });

    if (studentsError) {
      setStatus(`Import failed: ${studentsError.message}`);
      return;
    }

    const orgNames = [...new Set(previewRows.flatMap((row) => row.organizations || []))];

    if (orgNames.length) {
      const { error: organizationsError } = await supabase
        .from("organizations")
        .upsert(orgNames.map((name) => ({ name })), { onConflict: "name", ignoreDuplicates: false });

      if (organizationsError) {
        setStatus(`Students imported, but organization sync failed: ${organizationsError.message}`);
        return;
      }

      const [{ data: students }, { data: organizations }] = await Promise.all([
        supabase.from("students").select("id, student_id").in("student_id", previewRows.map((row) => row.student_id)),
        supabase.from("organizations").select("id, name").in("name", orgNames),
      ]);

      const studentMap = new Map((students || []).map((item) => [item.student_id, item.id]));
      const orgMap = new Map((organizations || []).map((item) => [item.name, item.id]));

      const membershipRows = [];
      previewRows.forEach((row) => {
        const studentId = studentMap.get(row.student_id);
        if (!studentId) return;
        (row.organizations || []).forEach((org) => {
          const orgId = orgMap.get(org);
          if (!orgId) return;
          membershipRows.push({ student_id: studentId, organization_id: orgId });
        });
      });

      if (membershipRows.length) {
        await supabase
          .from("student_organizations")
          .upsert(membershipRows, { onConflict: "student_id,organization_id", ignoreDuplicates: true });
      }
    }

    setStatus(`Import complete. Processed ${previewRows.length} student records.`);
  };

  const rowsForTable = useMemo(() => previewRows.map((row, index) => ({ ...row, id: index + 1 })), [previewRows]);

  return (
    <section className="page-stack">
      <div className="page-header">
        <h1>Students</h1>
        <p>Upload Excel files and import student eligibility records.</p>
      </div>

      <FileUpload onParsed={setPreviewRows} />

      <div className="button-row">
        <button type="button" className="btn btn-primary" onClick={importRows} disabled={!previewRows.length}>
          Confirm Import
        </button>
      </div>

      {status ? <p className="alert info">{status}</p> : null}

      <DataTable columns={COLUMNS} rows={rowsForTable} />
    </section>
  );
}
