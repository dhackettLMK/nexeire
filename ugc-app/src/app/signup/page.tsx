import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function SignupPage() {
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
          <h1 className="mt-4 font-display text-4xl font-medium leading-[1.05] tracking-tight text-balance">
            New workspaces are closed
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground text-pretty">
            Nexeire is not accepting public signups right now. Existing
            customers and admins can still sign in.
          </p>
        </div>
        <Link
          href="/login?next=/app"
          className={buttonClasses({ className: "w-full" })}
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
