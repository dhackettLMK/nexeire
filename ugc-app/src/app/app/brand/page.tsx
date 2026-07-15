import { Save } from "lucide-react";
import { saveBrandProfileAction } from "@/app/app/actions";
import { LogoUploadField } from "@/app/app/brand/logo-upload-field";
import { brandIntakeQuestions } from "@/lib/brand-intake/questions";
import {
  brandProfileSummaryItems,
  brandProfileValue,
  getBrandProfileCompletion,
  type BrandProfile,
} from "@/lib/brand-intake/profile";
import { signedOrganizationLogoUrl } from "@/lib/assets/logo";
import { requireOrganization } from "@/lib/customer/organization";
import { PageHeader, TitleAccent } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { inputClasses } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/loading-button";
import { AnimatedNumber } from "@/components/ui/animated-number";

type IntakeMessage = {
  id: string;
  author: string;
  prompt_key: string;
  content: string;
  sort_order: number;
};

async function getBrandData(
  supabase: Awaited<ReturnType<typeof requireOrganization>>["supabase"],
  organizationId: string,
) {
  const profileResult = await supabase
    .from("brand_profiles")
    .select(
      "id,organization_id,business_name,website_url,social_links,location,industry,what_they_do,why_they_do_it,promoting,target_customer,main_pain_points,offer_cta,tone,tone_examples,raw_notes,status",
    )
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (profileResult.error) {
    throw new Error(profileResult.error.message);
  }

  const profile = profileResult.data as BrandProfile | null;
  const messageResult = profile?.id
    ? await supabase
        .from("intake_messages")
        .select("id,author,prompt_key,content,sort_order")
        .eq("organization_id", organizationId)
        .eq("brand_profile_id", profile.id)
        .order("sort_order", { ascending: true })
    : { data: [], error: null };

  if (messageResult.error) {
    throw new Error(messageResult.error.message);
  }

  return {
    profile,
    messages: (messageResult.data ?? []) as IntakeMessage[],
  };
}

function InputForQuestion({
  profile,
  question,
}: {
  profile: BrandProfile | null;
  question: (typeof brandIntakeQuestions)[number];
}) {
  const defaultValue = brandProfileValue(profile, question.name);

  if (question.input === "textarea") {
    return (
      <textarea
        id={question.name}
        name={question.name}
        rows={question.name === "raw_notes" ? 5 : 3}
        required={question.required}
        defaultValue={defaultValue}
        className={inputClasses}
      />
    );
  }

  return (
    <input
      id={question.name}
      name={question.name}
      type={question.input}
      required={question.required}
      defaultValue={defaultValue}
      className={inputClasses}
    />
  );
}

export default async function BrandPage() {
  const { supabase, organization } = await requireOrganization("/app/brand");
  const { profile, messages } = await getBrandData(supabase, organization.id);
  const completion = getBrandProfileCompletion(profile);
  const orgInitial = organization.name.charAt(0).toUpperCase();
  const logoUrl = await signedOrganizationLogoUrl(
    supabase,
    organization.logo_path,
  );

  return (
    <div className="app-stagger grid gap-8">
      <PageHeader
        eyebrow="Step 01"
        title={
          <>
            Brand <TitleAccent>intake</TitleAccent>
          </>
        }
        description="Answer these prompts once. The saved profile becomes the reusable source for scripts, asset requests, and future video generation."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="grid gap-5">
          <Card className="grid gap-4 p-5">
            <div>
              <h2 className="font-medium text-foreground">Brand logo</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Upload your logo and it replaces the workspace initial in the
                sidebar and topbar.
              </p>
            </div>
            <LogoUploadField
              organizationId={organization.id}
              orgInitial={orgInitial}
              logoUrl={logoUrl}
            />
          </Card>
          <form action={saveBrandProfileAction} className="grid gap-4">
            {brandIntakeQuestions.map((question, index) => (
              <Card key={question.name} className="grid gap-4 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent font-mono text-xs font-semibold text-accent-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <label
                      htmlFor={question.name}
                      className="font-medium text-foreground"
                    >
                      {question.prompt}
                    </label>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {question.helper}
                    </p>
                  </div>
                </div>
                <div className="md:ml-11">
                  <InputForQuestion profile={profile} question={question} />
                </div>
              </Card>
            ))}
            <SubmitButton icon={<Save className="size-4" />} className="w-fit">
              Save brand intake
            </SubmitButton>
          </form>
        </section>
        <aside className="app-stagger grid h-fit gap-4 xl:sticky xl:top-12">
          <Card className="p-5">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-primary/80">
              Profile readiness
            </p>
            <p className="mt-4 text-4xl font-bold tabular-nums text-foreground">
              <AnimatedNumber value={completion.percent} suffix="%" />
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {completion.completedRequired} of {completion.totalRequired}{" "}
              required answers complete.
            </p>
            {completion.missingRequired.length > 0 ? (
              <div className="mt-4 rounded-xl bg-amber-400/10 px-3 py-2 text-sm text-amber-200 ring-1 ring-amber-400/25">
                Missing: {completion.missingRequired.join(", ")}
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-400/25">
                This profile is ready for script generation.
              </div>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Structured profile
            </h2>
            <dl className="mt-4 grid gap-3 text-sm">
              {brandProfileSummaryItems(profile).slice(0, 7).map((item) => (
                <div key={item.label}>
                  <dt className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="mt-1 line-clamp-3 text-foreground">
                    {item.value || "Not answered"}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="p-5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Saved transcript
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {messages.length > 0
                ? `${messages.length} prompt and answer rows saved.`
                : "No transcript saved yet."}
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
