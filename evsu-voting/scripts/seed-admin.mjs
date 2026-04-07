/**
 * Seed script: Creates the default admin account.
 *
 * Run once with:  node scripts/seed-admin.mjs
 *
 * Credentials:
 *   Email:    admin@evsu.edu.ph
 *   Password: admin12345
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

try {
  const envPath = resolve(process.cwd(), ".env.local");
  const envContent = readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const [key, ...value] = line.trim().split("=");
    if (key && !key.startsWith("#")) {
      process.env[key] = value.join("=");
    }
  });
} catch (err) {
  console.log("No .env.local file found or error reading it.");
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Prefer service role key if available, otherwise fall back to anon key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_EMAIL = "jonjon.albao!@evsu.edu.ph";
const ADMIN_PASSWORD = "admin12345";
const ADMIN_NAME = "System Administrator";

async function seedAdmin() {
  console.log("🔧 Seeding default admin account...\n");

  // Step 1: Sign up the admin user
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${"*".repeat(ADMIN_PASSWORD.length)}\n`);

  // Try using admin API first (service role key), then fall back to signUp
  let userId = null;

  if (SUPABASE_SERVICE_KEY) {
    // Use admin API (no email confirmation needed)
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });

    if (error) {
      if (error.message.includes("already been registered") || error.message.includes("already exists")) {
        console.log("   ℹ️  Auth user already exists, fetching ID...");
        const { data: users } = await supabase.auth.admin.listUsers();
        const existing = users?.users?.find((u) => u.email === ADMIN_EMAIL);
        if (existing) userId = existing.id;
      } else {
        console.error("   ❌ Error creating auth user:", error.message);
        process.exit(1);
      }
    } else {
      userId = data.user.id;
      console.log("   ✅ Auth user created (email auto-confirmed)");
    }
  } else {
    // Fall back to signUp (may require email verification)
    const { data, error } = await supabase.auth.signUp({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (error) {
      if (error.message.includes("already been registered") || error.message.includes("already exists")) {
        console.log("   ℹ️  Auth user already exists, signing in to get ID...");
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
        });
        if (signInError) {
          console.error("   ❌ Could not sign in:", signInError.message);
          process.exit(1);
        }
        userId = signInData.user.id;
      } else {
        console.error("   ❌ Error creating auth user:", error.message);
        process.exit(1);
      }
    } else {
      userId = data.user?.id;
      console.log("   ✅ Auth user created");
      if (data.user && !data.user.confirmed_at) {
        console.log("   ⚠️  Note: Email confirmation may be required.");
        console.log("      Disable 'Confirm email' in Supabase > Auth > Settings for dev.");
      }
    }
  }

  if (!userId) {
    console.error("   ❌ Could not get user ID. Aborting.");
    process.exit(1);
  }

  console.log(`   🆔 User ID: ${userId}\n`);

  let access_token = null;

  // Ensure we are signed in as this user so RLS lets us insert the profile
  if (!SUPABASE_SERVICE_KEY) {
    console.log("   ℹ️  Signing in to satisfy RLS for profile creation...");
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (signInErr) {
      console.error("   ❌ Sign in failed (Email might need confirmation?):", signInErr.message);
      console.log("\n   💡 FIX: Go to Supabase > Authentication > Users");
      console.log("   Confirm the email address for jonjon.albao!@evsu.edu.ph, then run this script again.");
      process.exit(1);
    }
    access_token = signInData.session.access_token;
  }

  // Create an authenticated client to perform the profile insert
  const authClient = access_token 
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${access_token}` } }
      })
    : supabase;

  // Step 2: Upsert the admin profile
  const { error: profileError } = await authClient.from("profiles").upsert(
    {
      id: userId,
      full_name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      role: "admin",
    },
    { onConflict: "id" }
  );

  if (profileError) {
    console.error("   ❌ Error creating profile:", profileError.message);
    process.exit(1);
  }

  console.log("   ✅ Admin profile created (role: admin)");
  console.log("\n🎉 Done! You can now log in at /login/admin with:");
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}\n`);
}

seedAdmin().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
