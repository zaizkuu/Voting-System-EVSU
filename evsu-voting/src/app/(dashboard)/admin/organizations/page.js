"use client";

import { useEffect, useMemo, useState } from "react";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import { createClient } from "@/lib/supabase/client";

const COLUMNS = [
  { key: "name", label: "Organization" },
  { key: "description", label: "Description" },
  { key: "member_count", label: "Members" },
  { key: "created_at", label: "Created" },
  { key: "actions", label: "Actions" },
];

const MEMBERSHIP_PAGE_SIZE = 200;
const STUDENT_LOOKUP_CHUNK_SIZE = 50;
const UUID_LIKE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

const fetchAllMembershipRows = async (supabase, organizationId = null) => {
  const rows = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("student_organizations")
      .select("id, student_id, organization_id")
      .order("id", { ascending: true })
      .range(from, from + MEMBERSHIP_PAGE_SIZE - 1);

    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error };
    }

    const batch = data || [];
    if (!batch.length) {
      break;
    }

    rows.push(...batch);
    from += batch.length;
  }

  return { data: rows, error: null };
};

const fetchStudentsByColumnValues = async (supabase, columnName, values) => {
  const normalizedValues = [...new Set(
    values
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  )];

  if (!normalizedValues.length) {
    return { data: [], error: null };
  }

  const rows = [];

  for (const valueChunk of chunkArray(normalizedValues, STUDENT_LOOKUP_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("students")
      .select("id, student_id")
      .in(columnName, valueChunk);

    if (error) {
      return { data: null, error };
    }

    rows.push(...(data || []));
  }

  return { data: rows, error: null };
};

const fetchStudentsByIdentifiers = async (supabase, identifiers) => {
  const normalizedIdentifiers = [...new Set(
    identifiers
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  )];

  if (!normalizedIdentifiers.length) {
    return { data: [], error: null };
  }

  const uuidIdentifiers = normalizedIdentifiers.filter((identifier) => UUID_LIKE_PATTERN.test(identifier));

  const idLookupPromise = uuidIdentifiers.length
    ? fetchStudentsByColumnValues(supabase, "id", uuidIdentifiers)
    : Promise.resolve({ data: [], error: null });

  const studentIdLookupPromise = fetchStudentsByColumnValues(supabase, "student_id", normalizedIdentifiers);

  const [{ data: studentsByRowId, error: studentsByRowIdError }, { data: studentsByStudentId, error: studentsByStudentIdError }] = await Promise.all([
    idLookupPromise,
    studentIdLookupPromise,
  ]);

  if (studentsByRowIdError) {
    return { data: null, error: studentsByRowIdError };
  }

  if (studentsByStudentIdError) {
    return { data: null, error: studentsByStudentIdError };
  }

  const mergedStudentsById = new Map();
  [...(studentsByRowId || []), ...(studentsByStudentId || [])].forEach((student) => {
    const rowId = String(student?.id || "").trim();
    if (!rowId) return;
    mergedStudentsById.set(rowId, student);
  });

  return { data: [...mergedStudentsById.values()], error: null };
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
    const supabase = createClient();
    const [{ data: organizations, error: organizationsError }, { data: memberships, error: membershipsError }] = await Promise.all([
      supabase.from("organizations").select("id, name, description, created_at").order("name", { ascending: true }),
      fetchAllMembershipRows(supabase),
    ]);

    if (organizationsError) {
      setStatus(`Unable to load organizations: ${organizationsError.message}`);
      setOrganizationRows([]);
      return;
    }

    if (membershipsError) {
      setStatus(`Unable to load membership counts: ${membershipsError.message}`);
    }

    const memberCountByOrganizationId = new Map();
    (memberships || []).forEach((membership) => {
      const organizationId = membership.organization_id;
      if (!organizationId) return;
      memberCountByOrganizationId.set(
        organizationId,
        (memberCountByOrganizationId.get(organizationId) || 0) + 1,
      );
    });

    const normalizedRows = (organizations || []).map((organization) => ({
      ...organization,
      created_at: formatDate(organization.created_at),
      member_count: memberCountByOrganizationId.get(organization.id) || 0,
    }));

    setOrganizationRows(normalizedRows);
  };

  useEffect(() => {
    // Initial async load for organization table.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, []);

  const createOrganization = async (event) => {
    event.preventDefault();
    const supabase = createClient();

    const { error } = await supabase.from("organizations").insert({
      name: name.trim(),
      description: description.trim() || null,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setName("");
    setDescription("");
    setStatus("Organization created.");
    await loadRows();
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

    const supabase = createClient();
    const { data: memberships, error: membershipsError } = await fetchAllMembershipRows(supabase, organization.id);

    if (membershipsError) {
      setEditError(`Unable to load organization members: ${membershipsError.message}`);
      return;
    }

    const membershipStudentRefs = (memberships || []).map((row) => row.student_id).filter(Boolean);

    if (!membershipStudentRefs.length) {
      return;
    }

    const { data: students, error: studentsError } = await fetchStudentsByIdentifiers(supabase, membershipStudentRefs);

    if (studentsError) {
      setEditError(`Unable to load student IDs: ${studentsError.message}`);
      return;
    }

    const studentsByRowId = new Map();
    const studentsByStudentId = new Map();
    (students || []).forEach((student) => {
      const rowId = String(student.id || "").trim();
      const studentId = String(student.student_id || "").trim();
      if (rowId) {
        studentsByRowId.set(rowId, student);
      }
      if (studentId) {
        studentsByStudentId.set(studentId, student);
      }
    });

    const sortedStudentIds = [...new Set(
      membershipStudentRefs
        .map((studentRef) => String(studentRef || "").trim())
        .map((studentRef) => {
          const matchedStudent = studentsByRowId.get(studentRef) || studentsByStudentId.get(studentRef);
          return String(matchedStudent?.student_id || "").trim();
        })
        .filter(Boolean),
    )].sort((left, right) => left.localeCompare(right));

    if (!sortedStudentIds.length) {
      setEditError("Membership rows were found, but no matching Student IDs could be resolved. Please sync memberships and try again.");
      return;
    }

    setEditForm((previous) => ({
      ...previous,
      studentIdsText: sortedStudentIds.join("\n"),
    }));
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

    const supabase = createClient();
    const desiredStudentIds = parseStudentIds(editForm.studentIdsText);

    const { error: organizationUpdateError } = await supabase
      .from("organizations")
      .update({
        name: normalizedName,
        description: editForm.description.trim() || null,
      })
      .eq("id", editingOrganization.id);

    if (organizationUpdateError) {
      setEditError(organizationUpdateError.message);
      setSavingEdit(false);
      return;
    }

    let desiredStudentRows = [];
    let missingStudentIds = [];

    if (desiredStudentIds.length) {
      const { data: students, error: studentsError } = await fetchStudentsByColumnValues(
        supabase,
        "student_id",
        desiredStudentIds,
      );

      if (studentsError) {
        setEditError(`Unable to validate student IDs: ${studentsError.message}`);
        setSavingEdit(false);
        return;
      }

      desiredStudentRows = students || [];
      const foundIds = new Set(desiredStudentRows.map((student) => student.student_id));
      missingStudentIds = desiredStudentIds.filter((studentId) => !foundIds.has(studentId));
    }

    const { data: currentMemberships, error: currentMembershipsError } = await fetchAllMembershipRows(
      supabase,
      editingOrganization.id,
    );

    if (currentMembershipsError) {
      setEditError(`Unable to load current memberships: ${currentMembershipsError.message}`);
      setSavingEdit(false);
      return;
    }

    const desiredStudentRowIds = new Set(desiredStudentRows.map((student) => student.id));
    const currentMembershipStudentRefs = (currentMemberships || []).map((membership) => String(membership.student_id || "").trim()).filter(Boolean);
    const { data: currentMembershipStudents, error: currentMembershipStudentsError } = await fetchStudentsByIdentifiers(
      supabase,
      currentMembershipStudentRefs,
    );

    if (currentMembershipStudentsError) {
      setEditError(`Unable to resolve current memberships: ${currentMembershipStudentsError.message}`);
      setSavingEdit(false);
      return;
    }

    const resolvedStudentIdByMembershipRef = new Map();
    const studentsByCurrentRowId = new Map();
    const studentsByCurrentStudentId = new Map();

    (currentMembershipStudents || []).forEach((student) => {
      const rowId = String(student.id || "").trim();
      const studentId = String(student.student_id || "").trim();

      if (rowId) {
        studentsByCurrentRowId.set(rowId, student);
      }

      if (studentId) {
        studentsByCurrentStudentId.set(studentId, student);
      }
    });

    currentMembershipStudentRefs.forEach((membershipRef) => {
      const matchedStudent = studentsByCurrentRowId.get(membershipRef) || studentsByCurrentStudentId.get(membershipRef);
      if (matchedStudent?.id) {
        resolvedStudentIdByMembershipRef.set(membershipRef, matchedStudent.id);
        return;
      }

      if (UUID_LIKE_PATTERN.test(membershipRef)) {
        resolvedStudentIdByMembershipRef.set(membershipRef, membershipRef);
      }
    });

    const currentStudentRowIds = new Set([...resolvedStudentIdByMembershipRef.values()].filter(Boolean));

    const membershipsToInsert = desiredStudentRows
      .filter((student) => !currentStudentRowIds.has(student.id))
      .map((student) => ({
        student_id: student.id,
        organization_id: editingOrganization.id,
      }));

    const membershipsToRemove = (currentMemberships || [])
      .map((membership) => String(membership.student_id || "").trim())
      .filter(Boolean)
      .filter((membershipRef) => {
        const resolvedStudentId = resolvedStudentIdByMembershipRef.get(membershipRef);
        if (!resolvedStudentId) {
          return true;
        }

        return !desiredStudentRowIds.has(resolvedStudentId);
      });

    if (membershipsToRemove.length) {
      for (const studentChunk of chunkArray(membershipsToRemove, STUDENT_LOOKUP_CHUNK_SIZE)) {
        const { error: removeError } = await supabase
          .from("student_organizations")
          .delete()
          .eq("organization_id", editingOrganization.id)
          .in("student_id", studentChunk);

        if (removeError) {
          setEditError(`Unable to remove existing memberships: ${removeError.message}`);
          setSavingEdit(false);
          return;
        }
      }
    }

    if (membershipsToInsert.length) {
      const { error: insertError } = await supabase
        .from("student_organizations")
        .upsert(membershipsToInsert, { onConflict: "student_id,organization_id", ignoreDuplicates: true });

      if (insertError) {
        setEditError(`Unable to assign new memberships: ${insertError.message}`);
        setSavingEdit(false);
        return;
      }
    }

    const missingSuffix = missingStudentIds.length
      ? ` Student ID not found: ${missingStudentIds.join(", ")}.`
      : "";

    setStatus(`Organization updated. Synced ${desiredStudentRowIds.size} member(s).${missingSuffix}`);
    setSavingEdit(false);
    setEditingOrganization(null);
    setEditForm({ name: "", description: "", studentIdsText: "" });
    await loadRows();
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
    const supabase = createClient();

    const { count: linkedElections, error: linkedElectionsError } = await supabase
      .from("elections")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", deletingOrganization.id);

    if (linkedElectionsError) {
      setStatus(`Unable to validate linked elections: ${linkedElectionsError.message}`);
      setDeleting(false);
      return;
    }

    if ((linkedElections || 0) > 0) {
      setStatus(`Cannot delete organization while ${linkedElections} election(s) still reference it.`);
      setDeleting(false);
      return;
    }

    const { error } = await supabase
      .from("organizations")
      .delete()
      .eq("id", deletingOrganization.id);

    if (error) {
      setStatus(`Unable to delete organization: ${error.message}`);
      setDeleting(false);
      return;
    }

    setDeleting(false);
    setDeletingOrganization(null);
    setDeleteConfirm("");
    setStatus("Organization deleted.");
    await loadRows();
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
