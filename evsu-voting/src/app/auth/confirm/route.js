import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash =
    requestUrl.searchParams.get("token_hash")
    || requestUrl.searchParams.get("token")
    || requestUrl.searchParams.get("confirmation_token");
  const type = requestUrl.searchParams.get("type");
  const requestedNext = requestUrl.searchParams.get("next");
  const defaultNextPath = String(type || "").trim() === "recovery" ? "/reset-password" : "/login";
  const safeNextPath = requestedNext && requestedNext.startsWith("/") ? requestedNext : defaultNextPath;
  const isRecoveryFlow = String(type || "").trim() === "recovery" || safeNextPath === "/reset-password";

  const successUrl = new URL(safeNextPath, requestUrl.origin);
  if (!isRecoveryFlow) {
    successUrl.searchParams.set("verified", "1");
  }

  const failureUrl = new URL(isRecoveryFlow ? "/reset-password" : "/login", requestUrl.origin);
  failureUrl.searchParams.set("error", isRecoveryFlow ? "recovery_link_invalid" : "confirmation_failed");

  const supabase = await createClient();

  // Prefer token-hash verification because it does not depend on PKCE verifier cookies.
  if (tokenHash) {
    const allowedTypes = new Set([
      "signup",
      "invite",
      "magiclink",
      "recovery",
      "email_change",
      "email",
    ]);
    const normalizedType = allowedTypes.has(String(type || "").trim()) ? type : "email";
    const { error } = await supabase.auth.verifyOtp({
      type: normalizedType,
      token_hash: tokenHash,
    });
    return NextResponse.redirect(error ? failureUrl : successUrl);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return NextResponse.redirect(error ? failureUrl : successUrl);
  }

  if (isRecoveryFlow) {
    return NextResponse.redirect(new URL("/reset-password", requestUrl.origin));
  }

  const invalidLinkUrl = new URL("/login", requestUrl.origin);
  invalidLinkUrl.searchParams.set("error", "confirmation_link_invalid");
  return NextResponse.redirect(invalidLinkUrl);
}
