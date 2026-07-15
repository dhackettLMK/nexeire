import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { createWorkspaceAction } from "@/app/app/actions";
import {
  getCurrentOrganizationForUser,
  requireUser,
} from "@/lib/customer/organization";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Field, inputClasses } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/loading-button";

type SetupPageProps = {
  searchParams?: Promise<{
    business?: string;
  }>;
};

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const { supabase, user } = await requireUser("/app/setup");
  const { organization } = await getCurrentOrganizationForUser(supabase, user);
  const params = searchParams ? await searchParams : {};

  if (organization) {
    redirect("/app");
  }

  return (
    <div className="app-stagger mx-auto grid max-w-3xl gap-8">
      <PageHeader
        eyebrow="Setup"
        title="Set up your workspace"
        description="This creates the organization record used for your brand profile, uploaded assets, and future generated videos."
      />
      <Card asChild>
        <form action={createWorkspaceAction} className="grid gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Business name" htmlFor="business_name">
              <input
                id="business_name"
                name="business_name"
                required
                defaultValue={params.business ?? ""}
                className={inputClasses}
              />
            </Field>
            <Field label="Website" htmlFor="website_url">
              <input
                id="website_url"
                name="website_url"
                type="url"
                className={inputClasses}
              />
            </Field>
            <Field label="Location" htmlFor="location">
              <input id="location" name="location" className={inputClasses} />
            </Field>
            <Field label="Industry" htmlFor="industry">
              <input id="industry" name="industry" className={inputClasses} />
            </Field>
          </div>
          <Field
            label="Social links"
            htmlFor="social_links"
            hint="One per line, or comma separated."
          >
            <textarea
              id="social_links"
              name="social_links"
              rows={4}
              placeholder="https://instagram.com/yourbrand"
              className={inputClasses}
            />
          </Field>
          <SubmitButton icon={<Plus className="size-4" />} className="w-fit">
            Create workspace
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
