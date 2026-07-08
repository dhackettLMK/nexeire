"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Field, inputClasses } from "@/components/ui/field";
import { AsyncButton } from "@/components/ui/loading-button";

type LoginFormProps = {
  isConfigured: boolean;
  nextPath: string;
  setupRequired: boolean;
};

export function LoginForm({
  isConfigured,
  nextPath,
  setupRequired,
}: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isConfigured) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="grid gap-5">
        <Field label="Email" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={!isConfigured || isSubmitting}
            required
            className={inputClasses}
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={!isConfigured || isSubmitting}
            required
            className={inputClasses}
          />
        </Field>
        {setupRequired ? (
          <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 ring-1 ring-amber-600/20">
            Supabase env vars are not configured yet. Copy `.env.example` to
            `.env.local` and add your project URL, publishable key, and admin
            email.
          </p>
        ) : null}
        {error ? (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-red-600/20">
            {error}
          </p>
        ) : null}
        <AsyncButton
          type="submit"
          disabled={!isConfigured}
          isLoading={isSubmitting}
          size="lg"
          className="w-full"
        >
          Sign in
        </AsyncButton>
      </form>
    </Card>
  );
}
