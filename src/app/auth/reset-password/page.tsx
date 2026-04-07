import Link from "next/link";

import { updatePasswordFromReset } from "@/app/auth/actions";

type ResetPasswordPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const hasError = !!params?.error;

  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-900 text-xl font-black text-white shadow-md">
            P
          </div>
          <h1 className="text-2xl font-black text-stone-900">Naya Password Set Karo</h1>
          <p className="mt-1 text-sm text-stone-500">Keep at least 8 characters</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
          {hasError ? (
            <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {params?.error === "invalid"
                ? "Password must be at least 8 characters."
                : params?.error === "mismatch"
                  ? "Password and confirm password do not match."
                : "Unable to update password. The link may have expired."}
              {" "}
              <Link href="/auth/forgot-password" className="font-semibold underline">
                Request new link
              </Link>
            </div>
          ) : null}

          <form action={updatePasswordFromReset} className="space-y-3">
            <label htmlFor="password" className="block text-sm font-semibold text-stone-700">
              New Password
            </label>
            <input
              id="password"
              type="password"
              name="password"
              required
              minLength={8}
              placeholder="New password (min 8 chars)"
              autoComplete="new-password"
              className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none"
            />

            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-stone-700">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              required
              minLength={8}
              placeholder="Confirm new password"
              autoComplete="new-password"
              className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none"
            />

            <button
              type="submit"
              className="h-14 w-full rounded-xl bg-teal-700 text-base font-bold text-white active:bg-teal-800"
            >
              Password Update Karo
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-stone-500">
            <Link href="/" className="font-semibold text-stone-700 underline">
              Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
