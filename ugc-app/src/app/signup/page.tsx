import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

type SignupPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();

  if (configured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/app");
    }
  }

  async function signup(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const code = String(formData.get("code") ?? "").trim();

    const expected = process.env.SIGNUP_ACCESS_CODE;

    if (!expected || code !== expected) {
      redirect("/signup?error=" + encodeURIComponent("That access code is not valid."));
    }

    if (!email || !password) {
      redirect("/signup?error=" + encodeURIComponent("Email and password are required."));
    }

    const admin = getServiceRoleClient();
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      redirect("/signup?error=" + encodeURIComponent(createError.message));
    }

    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      redirect("/login?next=/app");
    }

    redirect("/app");
  }

  return (
    <main className="app-canvas flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Link
            href="/"
            className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.32em] text-primary"
          >
            Nexeire
          </Link>
          <h1 className="mt-4 font-display text-4xl font-medium leading-[1.05] tracking-tight">
            Create your workspace
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground text-pretty">
            Enter the access code you were given to set up your account.
          </p>
        </div>
        <form action={signup} className="grid gap-5">
          <div className="grid gap-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={inputClasses}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className={inputClasses}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="code" className="text-sm font-medium">
              Access code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              autoComplete="off"
              required
              className={inputClasses}
            />
          </div>
          {params.error ? (
            <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-red-600/20">
              {params.error}
            </p>
          ) : null}
          <button type="submit" className={buttonClasses({ className: "w-full" })}>
            Create account
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login?next=/app"
            className="text-primary underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
