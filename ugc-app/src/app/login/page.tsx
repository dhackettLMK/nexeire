import Link from "next/link";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    setup?: string;
  }>;
};

function safeNextPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/app";
  }

  return value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const configured = isSupabaseConfigured();

  if (configured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect(nextPath);
    }
  }

  return (
    <main className="app-canvas relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-1/4 h-72 w-72 animate-pulse rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-24 bottom-1/4 h-80 w-80 animate-pulse rounded-full bg-blue-400/10 blur-3xl [animation-delay:1.2s]" />
      </div>

      <div className="app-rise-in w-full max-w-md">
        <div className="mb-8">
          <Link
            href="/"
            className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.32em] text-primary"
          >
            Nexeire
          </Link>
          <h1 className="mt-4 font-display text-4xl font-medium leading-[1.05] tracking-tight">
            Welcome back
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground text-pretty">
            Sign in to your workspace to keep generating videos.
          </p>
        </div>
        <LoginForm
          isConfigured={configured}
          nextPath={nextPath}
          setupRequired={!configured || params.setup === "required"}
        />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          New workspaces are currently invite-only.
        </p>
      </div>
    </main>
  );
}
