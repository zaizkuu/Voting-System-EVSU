"use client";

import { useEffect, useMemo, useState } from "react";
import DataTable from "@/components/DataTable";
import FileUpload from "@/components/FileUpload";
import Modal from "@/components/Modal";

import { generateRegistrationReport } from "@/lib/pdf/generateReport";
import { Download } from "lucide-react";

const COLUMNS = [
  { key: "student_id", label: "Student ID" },
  { key: "full_name", label: "Full Name" },
  { key: "program", label: "Program" },
  { key: "department", label: "Department" },
  { key: "year_level", label: "Year Level" },
  { key: "is_registered", label: "Registered", format: (val) => val ? "Yes" : "No" },
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
    try {
      const res = await fetch("/api/students");
      const data = await res.json();
      if (!res.ok) {
        setStatus(`Unable to load student records: ${data.error}`);
        setRows([]);
      } else {
        setRows(data.students || []);
      }
    } catch {
      setStatus("Unable to load student records right now.");
      setRows([]);
    }
    setLoadingRows(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStudentRows();
  }, []);

  const importRows = async () => {
    if (!previewRows.length) return;
    setStatus("Importing records...");

    const uniqueRows = buildUniqueStudentRows(previewRows);
    if (!uniqueRows.length) {
      setStatus("Import failed: No valid student rows found.");
      return;
    }

    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: uniqueRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(`Import failed: ${data.error}`);
        return;
      }

      const duplicateCount = previewRows.length - uniqueRows.length;
      setPreviewRows([]);
      await loadStudentRows();

      if (duplicateCount > 0) {
        setStatus(`Import complete. Processed ${uniqueRows.length} unique students from ${previewRows.length} rows. Merged ${duplicateCount} duplicate Student ID rows.`);
        return;
      }
      setStatus(data.message || `Import complete. Processed ${uniqueRows.length} student records.`);
    } catch {
      setStatus("Unable to import student records right now.");
    }
  };

  const handleDownloadRegistrationReport = () => {
    if (!rows || rows.length === 0) {
      setStatus("No students available to generate a report.");
      return;
    }
    generateRegistrationReport({
      generatedAt: new Date().toLocaleString(),
      students: rows
    });
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
        <button 
          type="button" 
          className="btn btn-outline" 
          onClick={handleDownloadRegistrationReport} 
          disabled={!rows.length}
          style={{ display: "flex", gap: "8px", alignItems: "center" }}
        >
          <Download size={16} /> Registration PDF
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
