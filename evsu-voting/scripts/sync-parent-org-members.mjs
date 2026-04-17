import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envText = fs.readFileSync(".env.local", "utf8");
const env = {};

for (const rawLine of envText.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line) continue;
  if (line.startsWith("#")) continue;

  const splitIndex = line.indexOf("=");
  if (splitIndex < 0) continue;

  const key = line.slice(0, splitIndex).trim();
  const value = line.slice(splitIndex + 1);
  env[key] = value;
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
let key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

if (!url) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(1);
}

if (!key) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const parentOrganizationName = process.argv[2] || "ACES";
const childOrganizationNamesArg = process.argv[3] || "SITeS,IIEE,PICE";
const childOrganizationNames = childOrganizationNamesArg
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

if (!childOrganizationNames.length) {
  console.error("At least one child organization name is required.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const allOrganizationNames = [parentOrganizationName, ...childOrganizationNames];
const membershipPageSize = 300;

const fetchAllMemberships = async (organizationIds) => {
  const rows = [];
  let from = 0;

  while (true) {
    const response = await supabase
      .from("student_organizations")
      .select("id, organization_id, student_id")
      .in("organization_id", organizationIds)
      .order("id", { ascending: true })
      .range(from, from + membershipPageSize - 1);

    if (response.error) {
      console.error(`Unable to load memberships: ${response.error.message}`);
      process.exit(1);
    }

    const data = response.data ?? [];
    if (!data.length) {
      break;
    }

    for (const row of data) {
      rows.push(row);
    }

    from += data.length;
  }

  return rows;
};

const organizationsResponse = await supabase
  .from("organizations")
  .select("id, name")
  .in("name", allOrganizationNames);

if (organizationsResponse.error) {
  console.error(`Unable to load organizations: ${organizationsResponse.error.message}`);
  process.exit(1);
}

const organizations = organizationsResponse.data ?? [];
const idByName = new Map();
const nameById = new Map();

for (const organization of organizations) {
  idByName.set(organization.name, organization.id);
  nameById.set(organization.id, organization.name);
}

const parentOrganizationId = idByName.get(parentOrganizationName);
if (!parentOrganizationId) {
  console.error(`Parent organization not found: ${parentOrganizationName}`);
  process.exit(1);
}

const childOrganizationIds = [];
for (const childName of childOrganizationNames) {
  const childId = idByName.get(childName);
  if (!childId) {
    console.error(`Child organization not found: ${childName}`);
    process.exit(1);
  }
  childOrganizationIds.push(childId);
}

const membershipOrganizationIds = [parentOrganizationId, ...childOrganizationIds];
const memberships = await fetchAllMemberships(membershipOrganizationIds);
const parentMemberStudentIds = new Set();
const childUnionStudentIds = new Set();

for (const membership of memberships) {
  const organizationId = membership.organization_id;
  const studentRowId = membership.student_id;

  if (!studentRowId) continue;

  if (organizationId === parentOrganizationId) {
    parentMemberStudentIds.add(studentRowId);
    continue;
  }

  if (childOrganizationIds.includes(organizationId)) {
    childUnionStudentIds.add(studentRowId);
  }
}

const rowsToInsert = [];
for (const studentRowId of childUnionStudentIds) {
  if (parentMemberStudentIds.has(studentRowId)) continue;
  rowsToInsert.push({
    student_id: studentRowId,
    organization_id: parentOrganizationId,
  });
}

const chunkSize = 200;
for (let index = 0; index < rowsToInsert.length; index += chunkSize) {
  const chunk = rowsToInsert.slice(index, index + chunkSize);
  const upsertResponse = await supabase
    .from("student_organizations")
    .upsert(chunk, { onConflict: "student_id,organization_id", ignoreDuplicates: true });

  if (upsertResponse.error) {
    console.error(`Unable to insert parent memberships: ${upsertResponse.error.message}`);
    process.exit(1);
  }
}

const verifiedMemberships = await fetchAllMemberships(membershipOrganizationIds);
const verifiedParent = new Set();
const verifiedChildUnion = new Set();

for (const membership of verifiedMemberships) {
  if (membership.organization_id === parentOrganizationId) {
    verifiedParent.add(membership.student_id);
    continue;
  }

  if (childOrganizationIds.includes(membership.organization_id)) {
    verifiedChildUnion.add(membership.student_id);
  }
}

console.log(JSON.stringify({
  parent_organization: parentOrganizationName,
  child_organizations: childOrganizationNames,
  inserted_memberships: rowsToInsert.length,
  parent_total_after_sync: verifiedParent.size,
  child_union_total: verifiedChildUnion.size,
  parent_minus_child_union: verifiedParent.size - verifiedChildUnion.size,
}, null, 2));
