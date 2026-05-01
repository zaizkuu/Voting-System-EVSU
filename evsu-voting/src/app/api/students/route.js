import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

function getSupabaseAdmin() {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function normalizeStudentRow(row) {
  return {
    student_id: String(row?.student_id || "").trim(),
    full_name: String(row?.full_name || "").trim(),
    program: String(row?.program || "").trim(),
    department: String(row?.department || "").trim(),
    year_level: String(row?.year_level || "").trim(),
    organizations: Array.isArray(row?.organizations)
      ? row.organizations.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
  };
}

async function requireAdmin() {
  const sessionSupabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await sessionSupabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }

  const { data: profile } = await sessionSupabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Only administrators can access student records." }, { status: 403 }) };
  }

  return { user };
}

export async function GET() {
  try {
    const access = await requireAdmin();
    if (access.error) {
      return access.error;
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }

    const { data: students, error } = await supabaseAdmin
      .from("students")
      .select("id, student_id, full_name, program, department, year_level, is_registered")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ students: students || [] });
  } catch (error) {
    console.error("students GET error:", error);
    return NextResponse.json({ error: "Unable to load student records right now." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const access = await requireAdmin();
    if (access.error) {
      return access.error;
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }

    const payload = await request.json().catch(() => ({}));
    const inputRows = Array.isArray(payload?.rows) ? payload.rows : [];
    const normalizedRows = inputRows.map(normalizeStudentRow).filter((row) => row.student_id && row.full_name);

    if (!normalizedRows.length) {
      return NextResponse.json({ error: "No valid student rows found." }, { status: 400 });
    }

    // Upsert students
    const studentsPayload = normalizedRows.map((row) => ({
      student_id: row.student_id,
      full_name: row.full_name,
      program: row.program || null,
      department: row.department || null,
      year_level: row.year_level || null,
    }));

    const { error: studentsError } = await supabaseAdmin
      .from("students")
      .upsert(studentsPayload, { onConflict: "student_id", ignoreDuplicates: false });

    if (studentsError) {
      return NextResponse.json({ error: `Student import failed: ${studentsError.message}` }, { status: 500 });
    }

    // Handle organizations if any rows include them
    const orgNames = [...new Set(normalizedRows.flatMap((row) => row.organizations))];

    if (orgNames.length) {
      const { error: orgError } = await supabaseAdmin
        .from("organizations")
        .upsert(orgNames.map((name) => ({ name })), { onConflict: "name", ignoreDuplicates: true });

      if (orgError) {
        return NextResponse.json({
          message: `Students imported, but organization sync failed: ${orgError.message}`,
          importedCount: normalizedRows.length,
        });
      }

      const [{ data: students }, { data: organizations }] = await Promise.all([
        supabaseAdmin
          .from("students")
          .select("id, student_id")
          .in("student_id", normalizedRows.map((row) => row.student_id)),
        supabaseAdmin
          .from("organizations")
          .select("id, name")
          .in("name", orgNames),
      ]);

      const studentMap = new Map((students || []).map((s) => [s.student_id, s.id]));
      const orgMap = new Map((organizations || []).map((o) => [o.name, o.id]));

      const membershipRows = [];
      normalizedRows.forEach((row) => {
        const studentId = studentMap.get(row.student_id);
        if (!studentId) return;
        row.organizations.forEach((orgName) => {
          const orgId = orgMap.get(orgName);
          if (!orgId) return;
          membershipRows.push({ student_id: studentId, organization_id: orgId });
        });
      });

      if (membershipRows.length) {
        await supabaseAdmin
          .from("student_organizations")
          .upsert(membershipRows, { onConflict: "student_id,organization_id", ignoreDuplicates: true });
      }
    }

    return NextResponse.json({
      message: `Imported ${normalizedRows.length} student record(s).`,
      importedCount: normalizedRows.length,
    });
  } catch (error) {
    console.error("students POST error:", error);
    return NextResponse.json({ error: "Unable to import student records right now." }, { status: 500 });
  }
}