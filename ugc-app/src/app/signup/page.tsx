import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

type SignupPageProps = {
  searchParams: Promise<{ mode?: string; error?: string; requested?: string }>;
};

function getAdminEmail() {
  return (process.env.ADMIN_EMAILS ?? "").split(",")[0].trim();
}

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

  const mode = params.mode === "code" ? "code" : "request";

  async function requestAccess(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();

    if (!email) {
      redirect("/signup?error=" + encodeURIComponent("Please enter your email."));
    }

    const apiKey = process.env.RESEND_API_KEY;
    const to = getAdminEmail();

    if (!apiKey || !to) {
      redirect(
        "/signup?error=" +
          encodeURIComponent("Requests are unavailable right now. Please try again later."),
      );
    }

    let ok = false;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Nexeire <onboarding@resend.dev>",
          to: [to],
          reply_to: email,
          subject: "New Nexeire access request",
          html:
            "<h2>New access request</h2>" +
            "<p><strong>Email:</strong> " +
            email +
            "</p>" +
            (note ? "<p><strong>Note:</strong> " + note + "</p>" : "") +
            "<p>If you want them in, reply with the access code.</p>",
        }),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }

    if (!ok) {
      redirect(
        "/signup?error=" +
          encodeURIComponent("Could not send your request. Please try again."),
      );
    }

    redirect("/signup?requested=1");
  }

  async function signup(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const code = String(formData.get("code") ?? "").trim();

    const expected = process.env.SIGNUP_ACCESS_CODE;

    if (!expected || code !== expected) {
      redirect(
        "/signup?mode=code&error=" +
          encodeURIComponent("That access code is not valid."),
      );
    }

    if (!email || !password) {
      redirect(
        "/signup?mode=code&error=" +
          encodeURIComponent("Email and password are required."),
      );
    }

    const admin = getServiceRoleClient();
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      redirect("/signup?mode=code&error=" + encodeURIComponent(createError.message));
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
    <main className="app-canvas relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-1/4 h-72 w-72 animate-pulse rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-24 bottom-1/4 h-80 w-80 animate-pulse rounded-full bg-blue-400/10 blur-3xl [animation-delay:1.2s]" />
      </div>

      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.32em] text-primary"
            >
              Nexeire
            </Link>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[0.5rem] font-semibold uppercase tracking-[0.2em] text-primary ring-1 ring-primary/20">
              Beta
            </span>
          </div>

          {mode === "code" ? (
            <>
              <h1 className="mt-4 font-display text-4xl font-medium leading-[1.05] tracking-tight">
                Enter your access code
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground text-pretty">
                Approved? Enter the access code you were given to finish setting up your
                account.
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-4 font-display text-4xl font-medium leading-[1.05] tracking-tight">
                Request early access
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground text-pretty">
                Nexeire is in private beta. Drop your email and we&apos;ll be in touch with
                an access code.
              </p>
            </>
          )}
        </div>

        {params.requested ? (
          <div className="animate-in fade-in zoom-in-95 rounded-2xl bg-emerald-50 px-5 py-6 text-center ring-1 ring-emerald-600/20 duration-500">
            <p className="font-display text-lg text-emerald-900">Request received</p>
            <p className="mt-2 text-sm text-emerald-800">
              We&apos;ll email you an access code if you&apos;re approved.
            </p>
            <Link
              href="/signup?mode=code"
              className="mt-4 inline-block text-sm font-medium text-primary underline underline-offset-4"
            >
              I already have a code
            </Link>
          </div>
        ) : mode === "code" ? (
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
            <Link
              href="/signup"
              className="text-center text-sm text-muted-foreground underline underline-offset-4"
            >
              Don&apos;t have a code? Request access
            </Link>
          </form>
        ) : (
          <form action={requestAccess} className="grid gap-5">
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
              <label htmlFor="note" className="text-sm font-medium">
                Anything we should know?{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                id="note"
                name="note"
                type="text"
                autoComplete="off"
                className={inputClasses}
              />
            </div>
            {params.error ? (
              <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-red-600/20">
                {params.error}
              </p>
            ) : null}
            <button type="submit" className={buttonClasses({ className: "w-full" })}>
              Request access
            </button>
            <Link
              href="/signup?mode=code"
              className="text-center text-sm text-muted-foreground underline underline-offset-4"
            >
              I already have a code
            </Link>
          </form>
        )}

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
