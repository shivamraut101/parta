import Link from "next/link";

import { requestPasswordReset } from "@/app/auth/actions";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-700 text-xl font-black text-white shadow-md">
            ₹
          </div>
          <h1 className="text-2xl font-black text-stone-900">Password Reset</h1>
          <p className="mt-1 text-sm text-stone-500">Email daalo, reset link bhejte hain</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
          <form action={requestPasswordReset} className="space-y-3">
            <label htmlFor="email" className="block text-sm font-semibold text-stone-700">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              className="h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-base focus:border-teal-500 focus:outline-none"
            />
            <button
              type="submit"
              className="h-14 w-full rounded-xl bg-teal-700 text-base font-bold text-white active:bg-teal-800"
            >
              Reset Link Bhejo
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
