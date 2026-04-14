"use client";

import { useEffect, useMemo, useState } from "react";
import DataTable from "@/components/DataTable";
import FileUpload from "@/components/FileUpload";
import Modal from "@/components/Modal";
import { createClient } from "@/lib/supabase/client";

const COLUMNS = [
  { key: "student_id", label: "Student ID" },
  { key: "full_name", label: "Full Name" },
  { key: "program", label: "Program" },
  { key: "department", label: "Department" },
  { key: "year_level", label: "Year Level" },
];

const createEmptyManualForm = () => ({
  student_id: "",
  full_name: "",
  program: "",
  department: "",
  year_level: "",
  organizations: "",
});

const buildUniqueStudentRows = (rows) => {
  const studentMap = new Map();

  rows.forEach((row) => {
    const studentId = String(row.student_id || "").trim();
    if (!studentId) return;

    const organizations = [...new Set((row.organizations || []).map((item) => item.trim()).filter(Boolean))];

    if (!studentMap.has(studentId)) {
      studentMap.set(studentId, {
        ...row,
        student_id: studentId,
        organizations,
      });
      return;
    }

    const existing = studentMap.get(studentId);
    studentMap.set(studentId, {
      ...existing,
      full_name: row.full_name || existing.full_name,
      program: row.program || existing.program,
      department: row.department || existing.department,
      year_level: row.year_level || existing.year_level,
      organizations: [...new Set([...(existing.organizations || []), ...organizations])],
    });
  });

  return [...studentMap.values()];
};

export default function AdminStudentsPage() {
  const [previewRows, setPreviewRows] = useState([]);
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [status, setStatus] = useState("");
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState(createEmptyManualForm);
  const [manualError, setManualError] = useState("");

  const loadStudentRows = async () => {
    setLoadingRows(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("students")
      .select("id, student_id, full_name, program, department, year_level")
      .order("created_at", { ascending: false });

    if (error) {
      setStatus(`Unable to load student records: ${error.message}`);
      setRows([]);
      setLoadingRows(false);
      return;
    }

    setRows(data || []);
    setLoadingRows(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStudentRows();
  }, []);

  const importRows = async () => {
    if (!previewRows.length) return;

    setStatus("Importing records...");
    const supabase = createClient();

    // Prevent Postgres ON CONFLICT errors by merging duplicate Student IDs first.
    const uniqueRows = buildUniqueStudentRows(previewRows);
    if (!uniqueRows.length) {
      setStatus("Import failed: No valid student rows found.");
      return;
    }

    const studentsPayload = uniqueRows.map((row) => ({
      student_id: row.student_id,
      full_name: row.full_name,
      email: null,
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

    const orgNames = [...new Set(uniqueRows.flatMap((row) => row.organizations || []))];

    if (orgNames.length) {
      const { error: organizationsError } = await supabase
        .from("organizations")
        .upsert(orgNames.map((name) => ({ name })), { onConflict: "name", ignoreDuplicates: false });

      if (organizationsError) {
        setStatus(`Students imported, but organization sync failed: ${organizationsError.message}`);
        return;
      }

      const [{ data: students }, { data: organizations }] = await Promise.all([
        supabase.from("students").select("id, student_id").in("student_id", uniqueRows.map((row) => row.student_id)),
        supabase.from("organizations").select("id, name").in("name", orgNames),
      ]);

      const studentMap = new Map((students || []).map((item) => [item.student_id, item.id]));
      const orgMap = new Map((organizations || []).map((item) => [item.name, item.id]));

      const membershipRows = [];
      uniqueRows.forEach((row) => {
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

    const duplicateCount = previewRows.length - uniqueRows.length;
    setPreviewRows([]);
    await loadStudentRows();

    if (duplicateCount > 0) {
      setStatus(`Import complete. Processed ${uniqueRows.length} unique students from ${previewRows.length} rows. Merged ${duplicateCount} duplicate Student ID rows.`);
      return;
    }

    setStatus(`Import complete. Processed ${uniqueRows.length} student records.`);
  };

  const openManualModal = () => {
    setManualError("");
    setIsManualModalOpen(true);
  };

  const closeManualModal = () => {
    setIsManualModalOpen(false);
    setManualForm(createEmptyManualForm());
    setManualError("");
  };

  const updateManualField = (field, value) => {
    setManualForm((previous) => ({ ...previous, [field]: value }));
  };

  const addManualStudentRow = (event) => {
    event.preventDefault();

    const normalizedRow = {
      student_id: manualForm.student_id.trim(),
      full_name: manualForm.full_name.trim(),
      program: manualForm.program.trim(),
      department: manualForm.department.trim(),
      year_level: manualForm.year_level.trim(),
      organizations: manualForm.organizations
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };

    if (!normalizedRow.student_id) {
      setManualError("Student ID is required.");
      return;
    }

    if (!normalizedRow.full_name) {
      setManualError("Full Name is required.");
      return;
    }

    setPreviewRows((previousRows) => {
      const existingIndex = previousRows.findIndex(
        (row) => String(row.student_id || "").trim() === normalizedRow.student_id,
      );

      if (existingIndex === -1) {
        return [...previousRows, normalizedRow];
      }

      const existingRow = previousRows[existingIndex] || {};
      const mergedRow = {
        ...existingRow,
        ...normalizedRow,
        organizations: [
          ...new Set([...(existingRow.organizations || []), ...normalizedRow.organizations]),
        ],
      };

      const nextRows = [...previousRows];
      nextRows[existingIndex] = mergedRow;
      return nextRows;
    });

    setStatus("Manual student row added to preview. Click Confirm Import to save.");
    closeManualModal();
  };

  const rowsForTable = useMemo(() => {
    if (previewRows.length) {
      return previewRows.map((row, index) => ({ ...row, id: `preview-${index + 1}` }));
    }

    return rows;
  }, [previewRows, rows]);

  return (
    <section className="page-stack">
      <div className="page-header">
        <h1>Students</h1>
        <p>Upload Excel files and import student eligibility records.</p>
      </div>

      <FileUpload onParsed={setPreviewRows} />

      <div className="button-row">
        <button type="button" className="btn btn-outline" onClick={openManualModal}>
          Add Student ID Manually
        </button>
        <button type="button" className="btn btn-primary" onClick={importRows} disabled={!previewRows.length}>
          Confirm Import
        </button>
        {previewRows.length ? <p>Previewing {previewRows.length} row(s). Confirm import to save them.</p> : null}
      </div>

      {status ? <p className="alert info">{status}</p> : null}
      {!previewRows.length && loadingRows ? <p className="alert info">Loading student records...</p> : null}

      <DataTable columns={COLUMNS} rows={rowsForTable} />

      <Modal open={isManualModalOpen} title="Add Student Manually" onClose={closeManualModal}>
        <form className="form-grid" onSubmit={addManualStudentRow}>
          <div className="form-group">
            <label className="form-label" htmlFor="manual-student-id">Student ID</label>
            <input
              id="manual-student-id"
              className="form-input"
              placeholder="e.g. 2021-12345"
              value={manualForm.student_id}
              onChange={(event) => updateManualField("student_id", event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="manual-full-name">Full Name</label>
            <input
              id="manual-full-name"
              className="form-input"
              placeholder="e.g. Juan De La Cruz"
              value={manualForm.full_name}
              onChange={(event) => updateManualField("full_name", event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="manual-program">Program</label>
            <input
              id="manual-program"
              className="form-input"
              placeholder="e.g. BSIT"
              value={manualForm.program}
              onChange={(event) => updateManualField("program", event.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="manual-department">Department</label>
            <input
              id="manual-department"
              className="form-input"
              placeholder="e.g. COT"
              value={manualForm.department}
              onChange={(event) => updateManualField("department", event.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="manual-year-level">Year Level</label>
            <input
              id="manual-year-level"
              className="form-input"
              placeholder="e.g. 3"
              value={manualForm.year_level}
              onChange={(event) => updateManualField("year_level", event.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="manual-organizations">Organizations (optional)</label>
            <input
              id="manual-organizations"
              className="form-input"
              placeholder="e.g. CSG, IT Society"
              value={manualForm.organizations}
              onChange={(event) => updateManualField("organizations", event.target.value)}
            />
          </div>

          {manualError ? <p className="alert error">{manualError}</p> : null}

          <div className="button-row">
            <button type="submit" className="btn btn-primary">Add to Preview</button>
            <button type="button" className="btn btn-ghost" onClick={closeManualModal}>Cancel</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
