"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const authSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

function parseAuthPayload(formData: FormData) {
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    throw new Error("Please enter a valid email and a password with at least 8 characters.");
  }

  return parsed.data;
}

export async function signUpWithPassword(formData: FormData) {
  const payload = parseAuthPayload(formData);
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
  });

  if (error) {
    const message = encodeURIComponent(error.message);
    redirect(`/?authError=${message}`);
  }

  redirect("/?authNotice=check_email");
}

export async function signInWithPassword(formData: FormData) {
  const payload = parseAuthPayload(formData);
  const nextRaw = formData.get("next");
  const nextPath =
    typeof nextRaw === "string" && nextRaw.startsWith("/") && !nextRaw.startsWith("//")
      ? nextRaw
      : "/";
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: payload.email,
    password: payload.password,
  });

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      redirect("/?authError=email_not_confirmed");
    }

    const message = encodeURIComponent(error.message);
    redirect(`/?authError=${message}`);
  }

  redirect(nextPath);
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(formData: FormData) {
  const emailResult = z.string().trim().email().safeParse(formData.get("email"));
  if (!emailResult.success) {
    redirect("/?authError=invalid_email");
  }

  const supabase = await createSupabaseServerClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  await supabase.auth.resetPasswordForEmail(emailResult.data, {
    redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
  });

  // Always redirect with notice even if email doesn't exist (prevents user enumeration)
  redirect("/?authNotice=reset_email_sent");
}

export async function resendVerification(formData: FormData) {
  const emailResult = z.string().trim().email().safeParse(formData.get("email"));
  if (!emailResult.success) {
    redirect("/?authError=invalid_email");
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resend({ type: "signup", email: emailResult.data });
  redirect("/?authNotice=check_email");
}

export async function updatePasswordFromReset(formData: FormData) {
  const schema = z.object({
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  });
  const parsed = schema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    redirect("/auth/reset-password?error=invalid");
  }

  if (parsed.data.password !== parsed.data.confirmPassword) {
    redirect("/auth/reset-password?error=mismatch");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    redirect("/auth/reset-password?error=failed");
  }

  redirect("/?authNotice=password_updated");
}
