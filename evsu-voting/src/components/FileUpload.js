"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Upload, Download, FileSpreadsheet } from "lucide-react";

const REQUIRED_COLUMNS = [
  "Student ID",
  "Full Name",
  "Email",
  "Program",
  "Department",
  "Year Level",
];

export default function FileUpload({ onParsed }) {
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setFileName("");
      return;
    }
    
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const firstRow = rows[0] || {};
      const missing = REQUIRED_COLUMNS.filter((column) => !(column in firstRow));
      if (missing.length > 0) {
        setError(`Processing Error: Your selected file is missing required columns: ${missing.join(", ")}`);
        return;
      }

      const normalized = rows.map((row) => ({
        student_id: String(row["Student ID"] || "").trim(),
        full_name: String(row["Full Name"] || "").trim(),
        email: String(row["Email"] || "").trim().toLowerCase(),
        program: String(row["Program"] || "").trim(),
        department: String(row["Department"] || "").trim(),
        year_level: String(row["Year Level"] || "").trim(),
        organizations: String(row.Organization || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }));

      // Filter out totally empty rows
      const validRows = normalized.filter((row) => row.student_id && row.full_name);

      setError("");
      onParsed(validRows);
    } catch (uploadError) {
      setError(uploadError.message || "Failed to parse Excel file.");
    }
  };

  const downloadTemplate = () => {
    // Create an empty array with just the header keys to generate the template
    const templateData = [{
      "Student ID": "e.g. 2021-12345",
      "Full Name": "e.g. Juan De La Cruz",
      "Email": "e.g. juan.delacruz@evsu.edu.ph",
      "Program": "e.g. BSIT",
      "Department": "e.g. COT",
      "Year Level": "e.g. 3",
      "Organization": "e.g. CSG, IT Society (Comma separated if multiple)",
    }];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // Auto-size columns slightly for better template UX
    worksheet["!cols"] = [
      { wch: 15 }, // Student ID
      { wch: 25 }, // Full Name
      { wch: 30 }, // Email
      { wch: 15 }, // Program
      { wch: 15 }, // Department
      { wch: 12 }, // Year
      { wch: 40 }, // Organization
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");

    XLSX.writeFile(workbook, "EVSU_Student_Import_Template.xlsx");
  };

  return (
    <div className="glass-card" style={{ padding: "32px", marginBottom: "24px", display: "flex", flexDirection: "column", gap: "24px", alignItems: "center", textAlign: "center" }}>
      
      <div style={{ display: "flex", alignItems: "center", gap: "16px", background: "rgba(220, 38, 38, 0.05)", padding: "16px 24px", borderRadius: "12px", border: "1px dashed var(--maroon)" }}>
        <FileSpreadsheet className="text-brand-maroon" size={32} />
        <div style={{ textAlign: "left" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--maroon)" }}>Need the Excel Template?</h3>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--gray-600)", marginTop: "4px" }}>Download the exact format required for importing students.</p>
        </div>
        <button type="button" onClick={downloadTemplate} className="btn btn-outline" style={{ marginLeft: "16px", borderColor: "var(--maroon)", color: "var(--maroon)" }}>
          <Download size={16} /> Download .XLSX Template
        </button>
      </div>

      <div style={{ width: "100%", maxWidth: "500px", border: "2px dashed var(--border-default)", borderRadius: "16px", padding: "40px", background: "var(--white)", transition: "all 0.2s ease" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <Upload size={32} className="text-gray-400" />
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Select your file</h3>
          <p style={{ fontSize: "0.9rem", color: "var(--gray-500)", margin: 0 }}>Supported formats: .xlsx, .xls</p>
          
          <label htmlFor="xlsx-upload" className="btn btn-primary" style={{ marginTop: "16px", cursor: "pointer", display: "inline-flex" }}>
            Browse Files
          </label>
          <input id="xlsx-upload" type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: "none" }} />
          
          {fileName && (
            <div style={{ marginTop: "16px", padding: "8px 16px", background: "var(--gray-100)", borderRadius: "20px", fontSize: "0.85rem", color: "var(--gray-700)", fontWeight: 500 }}>
              File selected: {fileName}
            </div>
          )}
        </div>
      </div>

      {error ? (
        <div className="alert error" style={{ width: "100%" }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
