import Link from "next/link";
import {
  ArrowRight,
  Inbox,
  MessagesSquare,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import {
  getBrandProfileCompletion,
  type BrandProfile,
} from "@/lib/brand-intake/profile";
import { generateVideosAction } from "@/app/app/actions";
import { maxBatchSize, minBatchSize } from "@/lib/batches/rules";
import { requireOrganization } from "@/lib/customer/organization";
import { Card, CardLink } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Stat } from "@/components/ui/stat";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Field, inputClasses } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/loading-button";
import { buttonClasses, ButtonIcon } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function AppHomePage() {
  const { supabase, organization } = await requireOrganization("/app");
  const [profileResult, assetsResult, outputsResult] = await Promise.all([
    supabase
      .from("brand_profiles")
      .select(
        "id,business_name,website_url,social_links,location,industry,what_they_do,why_they_do_it,promoting,target_customer,main_pain_points,offer_cta,tone,tone_examples,raw_notes,status",
      )
      .eq("organization_id", organization.id)
      .maybeSingle(),
    supabase
      .from("organization_assets")
      .select("id,status")
      .eq("organization_id", organization.id)
      .neq("status", "archived"),
    supabase
      .from("video_outputs")
      .select("id,status")
      .eq("organization_id", organization.id),
  ]);

  if (profileResult.error) throw new Error(profileResult.error.message);
  if (assetsResult.error) throw new Error(assetsResult.error.message);
  if (outputsResult.error) throw new Error(outputsResult.error.message);

  const profile = profileResult.data as BrandProfile | null;
  const completion = getBrandProfileCompletion(profile);
  const uploads = assetsResult.data ?? [];
  const outputs = outputsResult.data ?? [];
  const readyOutputs = outputs.filter((o) => o.status === "ready").length;
  const renderingOutputs = outputs.filter((o) =>
    ["queued", "scripting", "voiceover", "rendering"].includes(o.status),
  ).length;

  const brandReady = completion.isComplete;
  const hasUploads = uploads.length > 0;
  const canGenerate = brandReady && hasUploads;

  return (
    <div className="app-stagger grid gap-10">
      <section className="max-w-2xl">
        <Eyebrow>Workspace</Eyebrow>
        <h1 className="mt-4 font-display text-4xl font-medium leading-[1.05] tracking-tight text-balance sm:text-5xl">
          {organization.name}
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground text-pretty">
          Upload clips and photos of your business, hit generate, and we&apos;ll
          write, edit, and render finished marketing videos for you to download.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Brand profile"
          value={<AnimatedNumber value={completion.percent} suffix="%" />}
          hint={`${completion.completedRequired} of ${completion.totalRequired} required answers`}
          accent={brandReady ? "positive" : "warning"}
        />
        <Stat
          label="Clips uploaded"
          value={<AnimatedNumber value={uploads.length} />}
          hint={hasUploads ? "Ready to use" : "Upload to get started"}
          icon={<UploadCloud className="size-4" aria-hidden="true" />}
        />
        <Stat
          label="Videos ready"
          value={<AnimatedNumber value={readyOutputs} />}
          hint={
            renderingOutputs > 0
              ? `${renderingOutputs} generating now`
              : "Generate your first batch"
          }
          icon={<Inbox className="size-4" aria-hidden="true" />}
        />
      </section>

      <section>
        <Card className="grid gap-5">
          <div>
            <h2 className="font-display text-2xl font-medium tracking-tight">
              Generate videos
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              We use your brand profile and uploaded clips to write scripts and
              render videos automatically. New videos land in your library.
            </p>
          </div>

          {canGenerate ? (
            <form
              action={generateVideosAction}
              className="grid gap-4 sm:grid-cols-[150px_170px_auto] sm:items-end"
            >
              <Field label="How many" htmlFor="batch_size">
                <input
                  id="batch_size"
                  name="batch_size"
                  type="number"
                  min={minBatchSize}
                  max={maxBatchSize}
                  defaultValue={3}
                  className={inputClasses}
                />
              </Field>
              <Field label="Length (seconds)" htmlFor="video_length_seconds">
                <input
                  id="video_length_seconds"
                  name="video_length_seconds"
                  type="number"
                  min={5}
                  max={60}
                  defaultValue={30}
                  className={inputClasses}
                />
              </Field>
              <SubmitButton icon={<Sparkles className="size-4" />}>
                Generate videos
              </SubmitButton>
            </form>
          ) : (
            <div className="grid gap-3 rounded-xl bg-muted/50 p-4 ring-1 ring-foreground/[0.05]">
              <p className="text-sm text-muted-foreground">
                Two quick things before your first generate:
              </p>
              <ol className="grid gap-2 text-sm">
                <li className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex size-5 items-center justify-center rounded-full font-mono text-[0.625rem]",
                      brandReady
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-primary text-primary-foreground",
                    )}
                  >
                    1
                  </span>
                  <Link href="/app/brand" className="underline-offset-4 hover:underline">
                    {brandReady ? "Brand profile complete" : "Finish your brand profile"}
                  </Link>
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex size-5 items-center justify-center rounded-full font-mono text-[0.625rem]",
                      hasUploads
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-primary text-primary-foreground",
                    )}
                  >
                    2
                  </span>
                  <Link href="/app/assets" className="underline-offset-4 hover:underline">
                    {hasUploads ? "Clips uploaded" : "Upload some clips or photos"}
                  </Link>
                </li>
              </ol>
            </div>
          )}
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link href="/app/assets" className="block">
          <CardLink className="flex items-center gap-4 p-5">
            <UploadCloud className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h3 className="font-medium tracking-tight">Uploads</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Add or manage your clips and photos
              </p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
          </CardLink>
        </Link>
        <Link href="/app/inbox" className="block">
          <CardLink className="flex items-center gap-4 p-5">
            <Inbox className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h3 className="font-medium tracking-tight">Videos</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Download finished videos
              </p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
          </CardLink>
        </Link>
      </section>

      {!brandReady ? (
        <section>
          <Link
            href="/app/brand"
            className={cn(buttonClasses({ variant: "outline" }), "w-fit")}
          >
            <MessagesSquare className="size-4" aria-hidden="true" />
            Finish brand profile
            <ButtonIcon>
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonIcon>
          </Link>
        </section>
      ) : null}
    </div>
  );
}
