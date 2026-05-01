"use client";

import { useEffect, useMemo, useState } from "react";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";


const COLUMNS = [
  { key: "name", label: "Organization" },
  { key: "description", label: "Description" },
  { key: "member_count", label: "Members" },
  { key: "created_at", label: "Created" },
  { key: "actions", label: "Actions" },
];

const MEMBERSHIP_PAGE_SIZE = 200;
const STUDENT_LOOKUP_CHUNK_SIZE = 50;

const parseStudentIds = (value) => (
  [...new Set(
    String(value || "")
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean),
  )]
);

const formatDate = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString();
};

const chunkArray = (values, chunkSize) => {
  const chunks = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
};



export default function OrganizationsPage() {
  const [organizationRows, setOrganizationRows] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [editingOrganization, setEditingOrganization] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    studentIdsText: "",
  });
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingOrganization, setDeletingOrganization] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const loadRows = async () => {
    try {
      const res = await fetch("/api/organizations");
      const data = await res.json();
      if (!res.ok) { setStatus(data.error); setOrganizationRows([]); return; }

      const memberCountByOrganizationId = new Map();
      (data.memberships || []).forEach((m) => {
        if (!m.organization_id) return;
        memberCountByOrganizationId.set(m.organization_id, (memberCountByOrganizationId.get(m.organization_id) || 0) + 1);
      });

      setOrganizationRows((data.organizations || []).map((org) => ({
        ...org,
        created_at: formatDate(org.created_at),
        member_count: memberCountByOrganizationId.get(org.id) || 0,
      })));
    } catch { setOrganizationRows([]); }
  };

  useEffect(() => {
    // Initial async load for organization table.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, []);

  const createOrganization = async (event) => {
    event.preventDefault();
    try {
      const res = await fetch("/api/organizations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) { setStatus(data.error); return; }
      setName(""); setDescription("");
      setStatus("Organization created.");
      await loadRows();
    } catch { setStatus("Unable to create organization."); }
  };

  const openEditModal = async (organization) => {
    setEditingOrganization(organization);
    setEditForm({
      name: organization.name || "",
      description: organization.description || "",
      studentIdsText: "",
    });
    setEditError("");
    setStatus("");

    try {
      const res = await fetch("/api/organizations");
      const data = await res.json();
      const memberships = (data.memberships || []).filter((m) => m.organization_id === organization.id);
      const studentRowIds = memberships.map((m) => m.student_id).filter(Boolean);
      if (!studentRowIds.length) return;

      const studentsRes = await fetch("/api/students");
      const studentsData = await studentsRes.json();
      const allStudents = studentsData.students || [];
      const memberStudents = allStudents.filter((s) => studentRowIds.includes(s.id));
      const sortedIds = memberStudents.map((s) => s.student_id).filter(Boolean).sort();
      setEditForm((prev) => ({ ...prev, studentIdsText: sortedIds.join("\n") }));
    } catch (err) {
      setEditError("Unable to load organization members.");
    }
  };

  const closeEditModal = () => {
    if (savingEdit) return;
    setEditingOrganization(null);
    setEditForm({ name: "", description: "", studentIdsText: "" });
    setEditError("");
  };

  const saveOrganizationChanges = async (event) => {
    event.preventDefault();

    if (!editingOrganization?.id) {
      return;
    }

    const normalizedName = editForm.name.trim();
    if (!normalizedName) {
      setEditError("Organization name is required.");
      return;
    }

    setSavingEdit(true);
    setEditError("");
    setStatus("");

    try {
      // Update org name/description
      const updateRes = await fetch(`/api/organizations/${editingOrganization.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalizedName, description: editForm.description.trim() || null }),
      });
      if (!updateRes.ok) { const d = await updateRes.json(); setEditError(d.error); setSavingEdit(false); return; }

      // Get desired student IDs and resolve to internal IDs
      const desiredStudentIds = parseStudentIds(editForm.studentIdsText);
      const studentsRes = await fetch("/api/students");
      const studentsData = await studentsRes.json();
      const allStudents = studentsData.students || [];

      const desiredStudentRows = allStudents.filter((s) => desiredStudentIds.includes(s.student_id));
      const foundIds = new Set(desiredStudentRows.map((s) => s.student_id));
      const missingStudentIds = desiredStudentIds.filter((id) => !foundIds.has(id));

      // Get current memberships
      const orgsRes = await fetch("/api/organizations");
      const orgsData = await orgsRes.json();
      const currentMemberships = (orgsData.memberships || []).filter((m) => m.organization_id === editingOrganization.id);

      const desiredRowIds = new Set(desiredStudentRows.map((s) => s.id));
      const currentRowIds = new Set(currentMemberships.map((m) => m.student_id));

      // Remove memberships no longer desired
      const toRemove = currentMemberships.filter((m) => !desiredRowIds.has(m.student_id));
      for (const m of toRemove) {
        await fetch(`/api/organizations/${editingOrganization.id}/members?membershipId=${m.id}`, { method: "DELETE" });
      }

      // Add new memberships
      const toAdd = desiredStudentRows.filter((s) => !currentRowIds.has(s.id));
      for (const s of toAdd) {
        await fetch(`/api/organizations/${editingOrganization.id}/members`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: s.id }),
        });
      }

      const missingSuffix = missingStudentIds.length ? ` Student ID not found: ${missingStudentIds.join(", ")}.` : "";
      setStatus(`Organization updated. Synced ${desiredRowIds.size} member(s).${missingSuffix}`);
      setSavingEdit(false);
      setEditingOrganization(null);
      setEditForm({ name: "", description: "", studentIdsText: "" });
      await loadRows();
    } catch (err) {
      setEditError("Unable to save changes.");
      setSavingEdit(false);
    }
  };

  const openDeleteModal = (organization) => {
    setDeletingOrganization(organization);
    setDeleteConfirm("");
    setStatus("");
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeletingOrganization(null);
    setDeleteConfirm("");
  };

  const deleteOrganization = async (event) => {
    event.preventDefault();

    if (!deletingOrganization?.id) {
      return;
    }

    if (deleteConfirm.trim() !== "DELETE") {
      setStatus('Type "DELETE" to confirm organization removal.');
      return;
    }

    setDeleting(true);
    setStatus("");
    try {
      const res = await fetch(`/api/organizations/${deletingOrganization.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setStatus(data.error); setDeleting(false); return; }
      setDeleting(false);
      setDeletingOrganization(null);
      setDeleteConfirm("");
      setStatus("Organization deleted.");
      await loadRows();
    } catch {
      setStatus("Unable to delete organization.");
      setDeleting(false);
    }
  };

  const rows = useMemo(
    () => organizationRows.map((row) => ({
      ...row,
      actions: (
        <div className="button-row">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void openEditModal(row)}>
            Edit
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => openDeleteModal(row)}
            style={{ borderColor: "var(--error)", color: "var(--error)" }}
          >
            Delete
          </button>
        </div>
      ),
    })),
    [organizationRows],
  );

  return (
    <section className="page-stack">
      <div className="page-header">
        <h1>Organizations</h1>
        <p>Manage student organizations for scoped elections.</p>
      </div>

      <form className="glass-card form-grid" onSubmit={createOrganization}>
        <input className="form-input" placeholder="Organization name" value={name} onChange={(event) => setName(event.target.value)} required />
        <textarea className="form-input" placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
        <button className="btn btn-primary" type="submit">Add Organization</button>
      </form>

      {status ? <p className="alert info">{status}</p> : null}
      <DataTable columns={COLUMNS} rows={rows} />

      <Modal open={Boolean(editingOrganization)} title="Edit Organization" onClose={closeEditModal}>
        <form className="form-grid" onSubmit={saveOrganizationChanges}>
          <div className="form-group">
            <label className="form-label" htmlFor="edit-org-name">Organization Name</label>
            <input
              id="edit-org-name"
              className="form-input"
              value={editForm.name}
              onChange={(event) => setEditForm((previous) => ({ ...previous, name: event.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-org-description">Description</label>
            <textarea
              id="edit-org-description"
              className="form-input"
              value={editForm.description}
              onChange={(event) => setEditForm((previous) => ({ ...previous, description: event.target.value }))}
              rows={2}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-org-students">Student IDs</label>
            <textarea
              id="edit-org-students"
              className="form-input"
              placeholder="Enter one Student ID per line or separate by commas"
              value={editForm.studentIdsText}
              onChange={(event) => setEditForm((previous) => ({ ...previous, studentIdsText: event.target.value }))}
              rows={8}
            />
            <p>
              Students listed here are granted membership for this organization and become eligible for organization-scoped elections.
            </p>
          </div>

          {editError ? <p className="alert error">{editError}</p> : null}

          <div className="button-row">
            <button type="submit" className="btn btn-primary" disabled={savingEdit}>
              {savingEdit ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={closeEditModal} disabled={savingEdit}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(deletingOrganization)} title="Delete Organization" onClose={closeDeleteModal}>
        <form className="form-grid" onSubmit={deleteOrganization}>
          <p>
            This removes the organization and its membership list. Type DELETE to confirm.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="delete-org-confirm">Confirmation</label>
            <input
              id="delete-org-confirm"
              className="form-input"
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              placeholder="DELETE"
              required
            />
          </div>

          <div className="button-row">
            <button type="button" className="btn btn-ghost" onClick={closeDeleteModal} disabled={deleting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-outline"
              disabled={deleting}
              style={{ borderColor: "var(--error)", color: "var(--error)", fontWeight: 700 }}
            >
              {deleting ? "Deleting..." : "Delete Organization"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
