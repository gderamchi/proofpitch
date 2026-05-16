"use client";

import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  Clipboard,
  CreditCard,
  Database,
  Download,
  LogIn,
  LogOut,
  Mic,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "framer-motion";
import Image from "next/image";
import { Player } from "@remotion/player";
import { useEffect, useRef, useState } from "react";
import { renderPitchPackMarkdown } from "@/lib/markdown-export";
import { buildProductHuntBookmarklet } from "@/lib/product-hunt-bookmarklet";
import { defaultReleaseDemoProps, ReleaseDemo } from "@/remotion/ReleaseDemo";
import type {
  ChannelDraft,
  GeneratePitchPackResponse,
  LaunchPack,
  PitchPack,
  QuotaSnapshot,
} from "@/lib/schemas";

type CheckoutPlan = "founder" | "pro" | "agency" | "single";
type AuthMode = "signup" | "login";
type LaunchPackResponse = LaunchPack & {
  channelDrafts: ChannelDraft[];
};

type SessionPayload = {
  configured: boolean;
  user: {
    id: string;
    email?: string | null;
  } | null;
  organization: unknown | null;
  quota?: QuotaSnapshot;
};

const providerStack = [
  { label: "OpenAI", icon: "/brand-icons/openai.png" },
  { label: "Tavily", icon: "/brand-icons/tavily.png" },
  { label: "fal", icon: "/brand-icons/fal.png" },
  { label: "Gradium", icon: "/brand-icons/gradium.png" },
  { label: "Pioneer by Fastino", icon: "/brand-icons/pioneer.png", surface: "dark" },
] as const;

const sampleLaunchInput = {
  sourceUrl: "https://example.com",
  productName: "ProofPitch",
  targetAudience: "Founder-led B2B teams",
  launchGoal: "Release with a pitch deck, Remotion demo video, voiceover, LinkedIn post, and X thread.",
  demoInstructions: "Show the public product page, explain the proof ledger, then close on the release pack.",
};

const storySteps = [
  {
    label: "Capture",
    title: "Start with the messy demo note.",
    copy: "A voice note, a product link, market context, and the claims the team wants to make.",
    icon: Mic,
  },
  {
    label: "Check",
    title: "Separate proof from hype.",
    copy: "Each sentence becomes supported, weak, user-provided, or blocked before it reaches the pitch.",
    icon: SearchCheck,
  },
  {
    label: "Ship",
    title: "Generate the release pack.",
    copy: "ProofPitch outputs the Slidev deck, Remotion video props, voiceover script, posts, and proof trail.",
    icon: ShieldCheck,
  },
];

const claimRows = [
  {
    status: "supported",
    text: "Outputs a 2-minute demo script, README snippet, and visual prompt.",
    source: "Project brief",
  },
  {
    status: "user-provided",
    text: "Uses OpenAI, Tavily, fal, Gradium, and Pioneer.",
    source: "Builder input",
  },
  {
    status: "unsupported",
    text: "Improves pitch performance by 40%.",
    source: "No evidence",
  },
];

const packItems = ["Slidev deck", "Remotion video", "Voiceover script"];

const pricingCards = [
  {
    id: "free",
    name: "Free",
    price: "0€",
    cadence: "forever",
    packs: "1 Release Pack / month",
    seats: "1 seat",
    cta: "Start free",
    copy: "Validate the workflow once before committing.",
    featured: false,
    features: ["Claim ledger", "Slidev deck", "Script-only mode"],
  },
  {
    id: "founder",
    name: "Founder",
    price: "39€",
    cadence: "/ month",
    packs: "10 Release Packs / month",
    seats: "1 seat",
    cta: "Start Founder",
    copy: "For a founder turning notes into reusable GTM material.",
    featured: false,
    features: ["Saved history", "Markdown export", "Stripe test checkout"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "99€",
    cadence: "/ month",
    packs: "40 Release Packs / month",
    seats: "3 seats",
    cta: "Start Pro",
    copy: "For small teams using ProofPitch every week.",
    featured: true,
    features: ["Version history", "Provider run logs", "Stripe test checkout"],
  },
  {
    id: "agency",
    name: "Agency",
    price: "299€",
    cadence: "/ month",
    packs: "150 Release Packs / month",
    seats: "5 seats",
    cta: "Talk to us",
    copy: "For client workspaces and repeated positioning work.",
    featured: false,
    features: ["Client workspaces", "White-label exports", "Stripe test checkout"],
  },
] as const satisfies Array<{
  id: "free" | CheckoutPlan;
  name: string;
  price: string;
  cadence: string;
  packs: string;
  seats: string;
  cta: string;
  copy: string;
  featured: boolean;
  features: string[];
}>;

function statusClass(status: string) {
  if (status === "supported") {
    return "border-emerald-300/45 bg-emerald-300/10 text-emerald-100";
  }

  if (status === "unsupported") {
    return "border-rose-300/45 bg-rose-300/10 text-rose-100";
  }

  if (status === "weak") {
    return "border-amber-300/45 bg-amber-300/10 text-amber-100";
  }

  return "border-cyan-300/45 bg-cyan-300/10 text-cyan-100";
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function providerClass(state: string) {
  if (state === "used") {
    return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  }

  if (state === "failed") {
    return "border-rose-300/30 bg-rose-300/10 text-rose-100";
  }

  if (state === "missing") {
    return "border-slate-400/20 bg-slate-400/10 text-slate-300";
  }

  return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
}

function OutputBlock({
  title,
  value,
  onCopy,
}: {
  title: string;
  value: string;
  onCopy?: (label: string, text: string) => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-400">{title}</p>
        {onCopy ? (
          <button
            type="button"
            onClick={() => onCopy(title, value)}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.045] text-slate-200 transition hover:border-cyan-200/35 hover:text-white"
            title={`Copy ${title}`}
            aria-label={`Copy ${title}`}
          >
            <Clipboard size={13} />
          </button>
        ) : null}
      </div>
      <p className="text-sm leading-6 text-slate-200">{value}</p>
    </div>
  );
}

function BrandMark({
  brand,
  size = "md",
}: {
  brand: (typeof providerStack)[number];
  size?: "sm" | "md";
}) {
  const dimension = size === "sm" ? 18 : 22;
  const hasDarkSurface = "surface" in brand && brand.surface === "dark";

  return (
    <span
      role="img"
      aria-label={brand.label}
      title={brand.label}
      className={`grid shrink-0 place-items-center rounded-full border shadow-sm shadow-black/20 ${
        hasDarkSurface ? "border-white/15 bg-slate-950" : "border-white/20 bg-white"
      } ${size === "sm" ? "h-6 w-6" : "h-9 w-9"}`}
    >
      <span
        aria-hidden="true"
        className="block bg-contain bg-center bg-no-repeat"
        style={{
          width: `${dimension}px`,
          height: `${dimension}px`,
          backgroundImage: `url(${brand.icon})`,
        }}
      />
    </span>
  );
}

function ProofPitchLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const dimensions = size === "sm" ? 28 : 40;

  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-lg border border-white/10 bg-[#07111d] shadow-lg shadow-black/25 ${
        size === "sm" ? "h-8 w-8" : "h-10 w-10"
      }`}
    >
      <Image
        src="/brand/proofpitch-logo.png"
        width={dimensions}
        height={dimensions}
        alt=""
        className="h-[82%] w-[82%] object-contain"
        preload={size === "md"}
      />
    </span>
  );
}

function EntryExperience() {
  return (
    <div
      data-proofpitch-intro="true"
      aria-hidden="true"
      className="proofpitch-intro-shell pointer-events-none fixed inset-0 z-50 overflow-hidden bg-[#020409]"
    >
      <div
        className="proofpitch-radiant-field absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full"
      />
      <div
        className="proofpitch-radiant-ring absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full"
      />
      <div
        className="proofpitch-radiant-core absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
      />
    </div>
  );
}

function ProductDemo({
  activeStep = 2,
  pitchPack,
  providers,
  isGenerating = false,
  onCopy,
  onExport,
  copyLabel,
  exportStatus,
}: {
  activeStep?: number;
  pitchPack?: PitchPack;
  providers?: GeneratePitchPackResponse["providers"];
  isGenerating?: boolean;
  onCopy?: (label: string, text: string) => void;
  onExport?: () => void;
  copyLabel?: string | null;
  exportStatus?: string | null;
}) {
  const showClaims = activeStep >= 1;
  const showPack = activeStep >= 2;
  const displayClaims =
    pitchPack?.claims.slice(0, 3).map((claim) => ({
      status: claim.status,
      text: claim.text,
      source: claim.sourceTitle || claim.sourceType,
    })) ?? claimRows;
  const displayPackItems = pitchPack
    ? ["Slidev deck", "Remotion demo", "Voiceover script"]
    : packItems;
  const readyLabel = isGenerating ? "running" : pitchPack ? "generated" : "ready";

  return (
    <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#0c1119]/94 p-4 shadow-2xl shadow-black/35">
      <div className="absolute inset-0 proofpitch-hero-grid opacity-70" />
      <div className="relative flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <ProofPitchLogo size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">ProofPitch</p>
            <p className="text-xs text-slate-400">raw context to release pack</p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-100">
          {readyLabel}
        </span>
      </div>

      {pitchPack ? (
        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          {onCopy ? (
            <button
              type="button"
              onClick={() => onCopy("Markdown", renderPitchPackMarkdown(pitchPack))}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-semibold text-white transition hover:border-cyan-200/35"
            >
              <Clipboard size={14} />
              {copyLabel === "Markdown" ? "Copied" : "Copy Markdown"}
            </button>
          ) : null}
          {onExport ? (
            <button
              type="button"
              onClick={onExport}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs font-semibold text-cyan-50 transition hover:border-cyan-200/45"
            >
              <Download size={14} />
              {exportStatus ?? "Export Markdown"}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="relative mt-4 grid gap-3">
        <div className="rounded-lg border border-white/10 bg-black/25 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <Mic size={16} className="text-cyan-200" />
            Founder note
          </div>
          <p className="text-sm leading-6 text-slate-300">
            “{pitchPack?.oneLiner ?? "We built a product narrative tool. It turns messy context into a clean, defensible pitch."}”
          </p>
        </div>

        <motion.div
          animate={{ opacity: showClaims ? 1 : 0.45, y: showClaims ? 0 : 8 }}
          className="rounded-lg border border-white/10 bg-white/[0.035] p-4"
        >
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <SearchCheck size={16} className="text-emerald-200" />
            Claim check
          </div>
          <div className="space-y-2">
            {displayClaims.map((claim) => (
              <div key={claim.text} className="rounded-lg border border-white/8 bg-black/25 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(
                      claim.status,
                    )}`}
                  >
                    {formatStatus(claim.status)}
                  </span>
                  <span className="text-xs text-slate-500">{claim.source}</span>
                  {claim.status === "unsupported" ? (
                    <CircleAlert size={14} className="ml-auto shrink-0 text-rose-200" />
                  ) : null}
                </div>
                <p
                  className={`text-sm leading-6 ${
                    claim.status === "unsupported"
                      ? "text-slate-500 line-through decoration-rose-300/70"
                      : "text-slate-200"
                  }`}
                >
                  {claim.text}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          animate={{ opacity: showPack ? 1 : 0.42, y: showPack ? 0 : 8 }}
          className="rounded-lg border border-cyan-200/20 bg-cyan-200/10 p-4"
        >
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <BadgeCheck size={16} className="text-cyan-100" />
            Release pack
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {displayPackItems.map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-100"
              >
                <CheckCircle2 size={15} className="shrink-0 text-emerald-200" />
                {item}
              </div>
            ))}
          </div>
          {pitchPack?.generatedMediaUrl ? (
            <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-black/25">
              <Image
                src={pitchPack.generatedMediaUrl}
                width={640}
                height={360}
                alt="Generated ProofPitch media"
                className="aspect-video w-full object-cover"
                unoptimized
              />
            </div>
          ) : null}
        </motion.div>

        {providers ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {Object.entries(providers).map(([name, report]) => (
              <span
                key={name}
                title={report.detail}
                className={`rounded-lg border px-2.5 py-2 text-[11px] font-semibold ${providerClass(
                  report.state,
                )}`}
              >
                {name}: {report.state}
              </span>
            ))}
          </div>
        ) : null}

        {pitchPack ? (
          <div className="grid gap-3">
            <OutputBlock title="Executive pitch" value={pitchPack.executivePitch} onCopy={onCopy} />
            <div className="grid gap-3 sm:grid-cols-2">
              <OutputBlock title="2-minute script" value={pitchPack.demoScript2Min} onCopy={onCopy} />
              <OutputBlock title="README snippet" value={pitchPack.readmeSnippet} onCopy={onCopy} />
            </div>
            <OutputBlock title="Media prompt" value={pitchPack.generatedMediaPrompt} onCopy={onCopy} />
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                <p className="text-xs font-semibold uppercase tracking-normal text-slate-400">Demo steps</p>
                <div className="mt-3 grid gap-2">
                  {pitchPack.liveDemoSteps.slice(0, 4).map((step) => (
                    <div key={step} className="flex gap-2 text-sm leading-6 text-slate-200">
                      <CheckCircle2 size={14} className="mt-1 shrink-0 text-emerald-200" />
                      {step}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                <p className="text-xs font-semibold uppercase tracking-normal text-slate-400">Risks</p>
                <div className="mt-3 grid gap-2">
                  {pitchPack.risks.slice(0, 3).map((risk) => (
                    <div key={risk} className="flex gap-2 text-sm leading-6 text-slate-200">
                      <CircleAlert size={14} className="mt-1 shrink-0 text-amber-200" />
                      {risk}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                <p className="text-xs font-semibold uppercase tracking-normal text-slate-400">Next steps</p>
                <div className="mt-3 grid gap-2">
                  {pitchPack.nextSteps.slice(0, 3).map((step) => (
                    <div key={step} className="flex gap-2 text-sm leading-6 text-slate-200">
                      <ArrowRight size={14} className="mt-1 shrink-0 text-cyan-200" />
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LaunchRoomPreview({
  launchPack,
  onCopy,
}: {
  launchPack?: LaunchPackResponse | null;
  onCopy?: (label: string, text: string) => void;
}) {
  if (!launchPack) {
    return (
      <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Database size={16} className="text-cyan-100" />
          Release Pack
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {["Slidev deck", "Remotion demo video", "Voiceover", "LinkedIn and X posts"].map((item) => (
            <div key={item} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-300">
              {item}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const productHuntDraft = launchPack.channelDrafts.find((draft) => draft.channel === "product_hunt");
  const channelLabels: Record<ChannelDraft["channel"], string> = {
    product_hunt: "Product Hunt",
    youtube: "YouTube",
    linkedin: "LinkedIn",
    x: "X",
  };

  return (
    <div className="grid gap-4 rounded-lg border border-cyan-200/20 bg-cyan-200/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Release Pack ready</p>
          <p className="mt-1 text-xs leading-5 text-cyan-100/75">
            Deck, demo video, voiceover, YouTube metadata, and social drafts from one reviewed story.
          </p>
        </div>
        <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
          {launchPack.status}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-black/25 p-3">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-400">Slidev deck</p>
          <p className="mt-2 text-sm text-white">{launchPack.pitchDeck.slideCount} slides</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{launchPack.pitchDeck.exports.map((item) => item.format).join(", ")}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/25 p-3">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-400">Remotion video</p>
          <p className="mt-2 text-sm text-white">{launchPack.demoVideo.status}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{launchPack.demoVideo.compositionId}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/25 p-3">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-400">Voiceover</p>
          <p className="mt-2 text-sm text-white">{launchPack.voiceover.status.replaceAll("_", " ")}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{launchPack.voiceover.provider}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10 bg-black/35">
        <Player
          component={ReleaseDemo}
          inputProps={launchPack.demoVideo.renderProps ?? defaultReleaseDemoProps}
          durationInFrames={180}
          fps={30}
          compositionWidth={1920}
          compositionHeight={1080}
          controls
          loop
          acknowledgeRemotionLicense
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
          }}
        />
      </div>

      <div className="rounded-lg border border-white/10 bg-black/25 p-3">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-400">Deck opener</p>
        <p className="mt-2 text-sm leading-6 text-slate-100">{launchPack.pitchPack.oneLiner}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {onCopy ? (
            <>
              <button
                type="button"
                onClick={() => onCopy("Slidev deck", launchPack.pitchDeck.markdown)}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-semibold text-white transition hover:border-cyan-200/35"
              >
                <Clipboard size={14} />
                Copy Slidev deck
              </button>
              <button
                type="button"
                onClick={() => onCopy("Voiceover script", launchPack.voiceover.script)}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-semibold text-white transition hover:border-cyan-200/35"
              >
                <Clipboard size={14} />
                Copy voiceover
              </button>
              {productHuntDraft?.safeAutofillUrl ? (
                <button
                  type="button"
                  onClick={() =>
                    onCopy(
                      "Product Hunt bookmarklet",
                      buildProductHuntBookmarklet({
                        launchPackId: launchPack.id,
                        token: productHuntDraft.autofillToken ?? "",
                        origin: window.location.origin,
                      }),
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-semibold text-white transition hover:border-cyan-200/35"
                >
                  <Clipboard size={14} />
                  Copy Product Hunt autofill
                </button>
              ) : null}
            </>
          ) : null}
          {productHuntDraft ? (
            <a
              href="https://www.producthunt.com/posts/new"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs font-semibold text-cyan-50 transition hover:border-cyan-200/45"
            >
              Open Product Hunt
              <ArrowRight size={14} />
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        {launchPack.channelDrafts.map((draft) => (
          <div key={draft.id} className="rounded-lg border border-white/10 bg-black/25 p-3">
            <p className="text-xs font-semibold text-white">{channelLabels[draft.channel]}</p>
            <p className="mt-2 text-[11px] leading-5 text-slate-400">{draft.publishStatus.replaceAll("_", " ")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScrollNarrative() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const [activeStep, setActiveStep] = useState(0);
  const progressScale = useTransform(scrollYProgress, [0, 1], [0.08, 1]);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const nextStep = Math.min(2, Math.max(0, Math.floor(latest * storySteps.length)));
    setActiveStep(nextStep);
  });

  const active = storySteps[activeStep];
  const ActiveIcon = active.icon;

  return (
    <section ref={sectionRef} className="relative h-[220vh] border-y border-white/10 bg-[#070a10]">
      <div className="sticky top-0 min-h-screen overflow-hidden">
        <div className="absolute inset-0 proofpitch-scroll-grid opacity-55" />
        <motion.div
          style={{ scaleX: progressScale, transformOrigin: "0% 50%" }}
          className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300"
        />

        <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:px-10">
          <div>
            <p className="text-sm font-medium text-cyan-100/75">The product in one scroll</p>
            <h2 className="mt-4 max-w-xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
              A messy note becomes a pitch you can defend.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-400">
              No extra story to decode. The scroll only shows the transformation: capture, check,
              ship.
            </p>

            <div className="mt-8 grid gap-3">
              {storySteps.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === activeStep;

                return (
                  <button
                    key={step.label}
                    type="button"
                    onClick={() => setActiveStep(index)}
                    className={`grid w-full grid-cols-[auto_1fr] items-center gap-3 rounded-lg border p-3 text-left transition ${
                      isActive
                        ? "border-cyan-200/45 bg-cyan-200/10 text-white"
                        : "border-white/10 bg-white/[0.025] text-slate-400 hover:border-white/20"
                    }`}
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.045]">
                      <Icon size={16} />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{step.label}</span>
                      <span className="block text-sm leading-6 text-slate-500">{step.title}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-cyan-300/14 via-transparent to-amber-300/12 blur-xl" />
            <div className="relative rounded-lg border border-white/10 bg-[#0b1018]/92 p-4 shadow-2xl shadow-black/35">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg border border-cyan-200/25 bg-cyan-200/10 text-cyan-100">
                    <ActiveIcon size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{active.label}</p>
                    <p className="text-xs text-slate-500">step {activeStep + 1} of 3</p>
                  </div>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                  live proof trail
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.86fr_1.14fr]">
                <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                  <h3 className="text-2xl font-semibold leading-tight text-white">{active.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-slate-400">{active.copy}</p>
                  <div className="mt-6 grid grid-cols-3 gap-2">
                    {storySteps.map((step, index) => (
                      <span
                        key={step.label}
                        className={`h-1.5 rounded-full ${
                          index <= activeStep ? "bg-cyan-200" : "bg-white/10"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <ProductDemo activeStep={activeStep} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AuthPanel({
  session,
  mode,
  pendingPlan,
  checkoutStatus,
  onModeChange,
  onAuthSuccess,
  onLogout,
  onCheckout,
}: {
  session: SessionPayload | null;
  mode: AuthMode;
  pendingPlan: CheckoutPlan | null;
  checkoutStatus: string | null;
  onModeChange: (mode: AuthMode) => void;
  onAuthSuccess: (session: SessionPayload) => void;
  onLogout: () => Promise<void>;
  onCheckout: (plan: CheckoutPlan, sessionOverride?: SessionPayload | null) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          name: mode === "signup" ? name || email.split("@")[0] : undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Authentication failed.");
      }

      if (data.needsEmailConfirmation) {
        setMessage("Check your email to confirm the account, then log in.");
        return;
      }

      onAuthSuccess(data as SessionPayload);
      setMessage(pendingPlan ? "Account ready. Opening checkout..." : "Account ready.");

      if (pendingPlan) {
        await onCheckout(pendingPlan, data as SessionPayload);
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (session?.user) {
    return (
      <div className="rounded-lg border border-emerald-200/20 bg-emerald-200/[0.075] p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">{session.user.email ?? "Signed in"}</p>
            <p className="text-xs leading-5 text-emerald-50/75">
              Saved history and paid checkout are enabled.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pendingPlan ? (
              <button
                type="button"
                onClick={() => onCheckout(pendingPlan, session)}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                <CreditCard size={14} />
                Continue checkout
              </button>
            ) : null}
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white transition hover:border-white/25"
            >
              <LogOut size={14} />
              Log out
            </button>
          </div>
        </div>
        {checkoutStatus ? <p className="mt-2 text-xs leading-5 text-cyan-100">{checkoutStatus}</p> : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Account for saved packs and checkout</p>
          <p className="text-xs leading-5 text-slate-400">
            Anonymous generation works now. Paid plans need an account.
          </p>
        </div>
        <div className="grid grid-cols-2 rounded-lg border border-white/10 bg-black/20 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onModeChange("signup")}
            className={`rounded-md px-3 py-1.5 transition ${
              mode === "signup" ? "bg-cyan-300 text-slate-950" : "text-slate-300 hover:text-white"
            }`}
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={() => onModeChange("login")}
            className={`rounded-md px-3 py-1.5 transition ${
              mode === "login" ? "bg-cyan-300 text-slate-950" : "text-slate-300 hover:text-white"
            }`}
          >
            Log in
          </button>
        </div>
      </div>
      <form onSubmit={submitAuth} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        {mode === "signup" ? (
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/45"
            placeholder="Name"
            autoComplete="name"
          />
        ) : null}
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/45"
          placeholder="Email"
          type="email"
          autoComplete="email"
          required
        />
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/45"
          placeholder="Password"
          type="password"
          minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mode === "signup" ? <UserPlus size={15} /> : <LogIn size={15} />}
          {isSubmitting ? "Working..." : mode === "signup" ? "Create" : "Log in"}
        </button>
      </form>
      {pendingPlan ? (
        <p className="mt-2 text-xs leading-5 text-cyan-100">
          Selected plan: {pendingPlan === "single" ? "Single Release Pack" : pendingPlan}.
        </p>
      ) : null}
      {message ? <p className="mt-2 text-xs leading-5 text-emerald-100">{message}</p> : null}
      {error ? <p className="mt-2 text-xs leading-5 text-rose-200">{error}</p> : null}
      {checkoutStatus ? <p className="mt-2 text-xs leading-5 text-cyan-100">{checkoutStatus}</p> : null}
    </div>
  );
}

function HeroSection({
  session,
  authMode,
  pendingPlan,
  checkoutStatus,
  checkoutNotice,
  onAuthModeChange,
  onAuthSuccess,
  onLogout,
  onCheckout,
}: {
  session: SessionPayload | null;
  authMode: AuthMode;
  pendingPlan: CheckoutPlan | null;
  checkoutStatus: string | null;
  checkoutNotice: string | null;
  onAuthModeChange: (mode: AuthMode) => void;
  onAuthSuccess: (session: SessionPayload) => void;
  onLogout: () => Promise<void>;
  onCheckout: (plan: CheckoutPlan, sessionOverride?: SessionPayload | null) => Promise<void>;
}) {
  const [sourceUrl, setSourceUrl] = useState(sampleLaunchInput.sourceUrl);
  const [productName, setProductName] = useState(sampleLaunchInput.productName);
  const [targetAudience, setTargetAudience] = useState(sampleLaunchInput.targetAudience);
  const [launchGoal, setLaunchGoal] = useState(sampleLaunchInput.launchGoal);
  const [demoInstructions, setDemoInstructions] = useState(sampleLaunchInput.demoInstructions);
  const [includeProductHunt, setIncludeProductHunt] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<LaunchPackResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [manualCopy, setManualCopy] = useState<{ label: string; text: string } | null>(null);

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/launch-packs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceUrl,
          productName,
          targetAudience,
          launchGoal,
          demoInstructions,
          releaseChannels: includeProductHunt
            ? ["youtube", "linkedin", "x", "product_hunt"]
            : ["youtube", "linkedin", "x"],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Release pack generation failed.");
      }

      setResult(data as LaunchPackResponse);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Release pack generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyOutput(label: string, text: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("Clipboard API unavailable.");
      }
      setError(null);
      setManualCopy(null);
      setCopyLabel(label);
      window.setTimeout(() => setCopyLabel(null), 1800);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.append(textarea);
      textarea.select();
      const didCopy = document.execCommand("copy");
      textarea.remove();

      if (!didCopy) {
        setError(null);
        setManualCopy({ label, text });
        setCopyLabel(`${label} ready`);
        return;
      }

      setError(null);
      setManualCopy(null);
      setCopyLabel(label);
      window.setTimeout(() => setCopyLabel(null), 1800);
    }
  }

  async function exportMarkdown() {
    if (!result?.pitchPack) {
      return;
    }

    setExportStatus("Preparing...");
    setError(null);

    try {
      let markdown = renderPitchPackMarkdown(result.pitchPack);
      markdown = [
        `# ${result.productName} Release Pack`,
        "",
        `Source: ${result.sourceUrl}`,
        `Goal: ${result.launchGoal}`,
        "",
        "## Slidev Deck",
        result.pitchDeck.markdown,
        "",
        "## Voiceover",
        result.voiceover.script,
        "",
        "## Remotion Render Props",
        JSON.stringify(result.demoVideo.renderProps, null, 2),
        "",
        "## Social Drafts",
        "### LinkedIn",
        result.socialPosts.linkedin.text,
        "",
        "### X",
        ...result.socialPosts.x.map((post) => post.text),
        "",
        markdown,
      ].join("\n");

      const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
      const anchor = document.createElement("a");
      const fileBase = `${result.pitchPack.projectName || "proofpitch"}-release-pack`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      anchor.href = url;
      anchor.download = `${fileBase}.md`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setExportStatus("Exported");
      window.setTimeout(() => setExportStatus(null), 1800);
    } catch (exportError) {
      setExportStatus(null);
      setError(exportError instanceof Error ? exportError.message : "Export failed.");
    }
  }

  return (
    <section id="generator" className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
      <nav className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ProofPitchLogo />
          <div>
            <p className="text-sm font-semibold text-white">ProofPitch</p>
            <p className="text-xs text-slate-500">release assets</p>
          </div>
        </div>

        <div className="order-3 flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1 text-xs font-medium text-slate-300 sm:order-none sm:w-auto">
          {providerStack.map((brand) => (
            <BrandMark key={brand.label} brand={brand} />
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setSourceUrl(sampleLaunchInput.sourceUrl);
            setProductName(sampleLaunchInput.productName);
            setTargetAudience(sampleLaunchInput.targetAudience);
            setLaunchGoal(sampleLaunchInput.launchGoal);
            setDemoInstructions(sampleLaunchInput.demoInstructions);
            setIncludeProductHunt(false);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:border-cyan-200/40 hover:bg-cyan-200/10"
        >
          <Clipboard size={15} />
          Load sample
        </button>
      </nav>

      <div className="grid flex-1 items-center gap-9 py-12 lg:grid-cols-[0.96fr_1.04fr] lg:py-8">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-sm text-cyan-100">
            <Sparkles size={15} />
            Release assets, not paste-only copy
          </div>

          <h1 className="max-w-4xl text-5xl font-semibold leading-[0.96] text-white sm:text-6xl lg:text-7xl">
            Product URL to release-ready assets.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Give ProofPitch a public product URL and release context. It prepares a Slidev pitch
            deck, Remotion demo video, voiceover, YouTube metadata, social posts, and proof-backed pitch.
          </p>

          <form
            onSubmit={handleGenerate}
          className="mt-7 grid gap-3 rounded-lg border border-white/10 bg-black/25 p-3 shadow-xl shadow-black/20"
        >
            <input
              id="generator-input"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              className="rounded-lg border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/45"
              placeholder="Public product URL"
              type="url"
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={productName}
                onChange={(event) => setProductName(event.target.value)}
                className="rounded-lg border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/45"
                placeholder="Product name"
                required
              />
              <input
                value={targetAudience}
                onChange={(event) => setTargetAudience(event.target.value)}
                className="rounded-lg border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/45"
                placeholder="Target audience"
                required
              />
            </div>
            <textarea
              value={launchGoal}
              onChange={(event) => setLaunchGoal(event.target.value)}
              rows={3}
              className="min-h-24 resize-none rounded-lg border border-white/10 bg-white/[0.045] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/45"
              placeholder="Release goal"
              required
            />
            <textarea
              value={demoInstructions}
              onChange={(event) => setDemoInstructions(event.target.value)}
              rows={3}
              className="min-h-24 resize-none rounded-lg border border-white/10 bg-white/[0.045] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/45"
              placeholder="Optional demo path instructions"
            />
            <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-slate-200">
              <span>Include optional Product Hunt handoff</span>
              <input
                checked={includeProductHunt}
                onChange={(event) => setIncludeProductHunt(event.target.checked)}
                type="checkbox"
                className="h-5 w-5 rounded border-white/20 bg-black/30 accent-cyan-300"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isGenerating}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {isGenerating ? "Building..." : "Generate Release Pack"}
                <ArrowRight size={16} />
              </button>
              <a
                href="#proofpitch-scroll"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-200/35"
              >
                See proof flow
              </a>
              {result ? (
                <span className="text-xs font-medium text-slate-400">
                  release pack: <span className="text-cyan-100">{result.status}</span>
                </span>
              ) : null}
            </div>
            {error ? <p className="text-sm leading-6 text-rose-200">{error}</p> : null}
            {copyLabel ? (
              <p className="text-sm leading-6 text-emerald-100">
                {manualCopy ? `${manualCopy.label} is ready below.` : `Copied ${copyLabel}.`}
              </p>
            ) : null}
            {checkoutNotice ? <p className="text-sm leading-6 text-cyan-100">{checkoutNotice}</p> : null}
            {manualCopy ? (
              <div className="grid gap-2 rounded-lg border border-cyan-200/25 bg-cyan-200/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-normal text-cyan-100">
                    Copy buffer: {manualCopy.label}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setManualCopy(null);
                      setCopyLabel(null);
                    }}
                    className="rounded-lg border border-white/10 px-2 py-1 text-xs font-semibold text-white transition hover:border-cyan-200/35"
                  >
                    Close
                  </button>
                </div>
                <textarea
                  readOnly
                  value={manualCopy.text}
                  onFocus={(event) => event.currentTarget.select()}
                  rows={5}
                  className="max-h-44 resize-y rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs leading-5 text-slate-100 outline-none focus:border-cyan-200/45"
                />
              </div>
            ) : null}
          </form>

          <div className="mt-4">
            <LaunchRoomPreview launchPack={result} onCopy={copyOutput} />
          </div>

          <div className="mt-4">
            <AuthPanel
              session={session}
              mode={authMode}
              pendingPlan={pendingPlan}
              checkoutStatus={checkoutStatus}
              onModeChange={onAuthModeChange}
              onAuthSuccess={onAuthSuccess}
              onLogout={onLogout}
              onCheckout={onCheckout}
            />
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {storySteps.map((step) => {
              const Icon = step.icon;

              return (
                <div key={step.label} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                    <span className="grid h-7 w-7 place-items-center rounded-lg border border-cyan-200/25 bg-cyan-200/10 text-cyan-100">
                      <Icon size={15} />
                    </span>
                    {step.label}
                  </div>
                  <p className="text-xs leading-5 text-slate-400">{step.title}</p>
                </div>
              );
            })}
          </div>

        </div>

        <ProductDemo
          pitchPack={result?.pitchPack}
          isGenerating={isGenerating}
          onCopy={result?.pitchPack ? copyOutput : undefined}
          onExport={result?.pitchPack ? exportMarkdown : undefined}
          copyLabel={copyLabel}
          exportStatus={exportStatus}
        />
      </div>
    </section>
  );
}

function PricingSection({
  onFreeSelect,
  onPlanSelect,
}: {
  onFreeSelect: () => void;
  onPlanSelect: (plan: CheckoutPlan) => void;
}) {
  return (
    <section id="pricing" className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
      <div className="mb-8 grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
        <div>
          <h2 className="max-w-2xl text-3xl font-semibold leading-tight text-white sm:text-5xl">
            Pricing follows the output: one Release Pack at a time.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-400">
            Seats matter later. The first pricing unit is the verified pack: story, claims, sources,
            deck, video, voiceover, posts, and provider trace.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-amber-200/25 bg-amber-200/[0.08] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
              <CreditCard size={16} />
              Single Release Pack
            </div>
            <p className="mt-3 text-3xl font-semibold text-white">49€</p>
            <p className="mt-2 text-sm leading-6 text-amber-50/75">
              One test-mode Stripe checkout for a single project when a subscription is too much.
            </p>
            <button
              type="button"
              onClick={() => onPlanSelect("single")}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-200 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-100"
            >
              Buy one
              <ArrowRight size={15} />
            </button>
          </div>

          <div className="rounded-lg border border-cyan-200/25 bg-cyan-200/[0.08] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
              <Database size={16} />
              Test billing wired
            </div>
            <p className="mt-3 text-3xl font-semibold text-white">Stripe test</p>
            <p className="mt-2 text-sm leading-6 text-cyan-50/75">
              Plans, quotas, and checkout sessions are routed through test-mode billing.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        {pricingCards.map((plan) => (
          <div
            key={plan.name}
            className={`relative flex min-h-[360px] flex-col rounded-lg border p-4 ${
              plan.featured
                ? "border-cyan-200/45 bg-cyan-200/[0.1] shadow-2xl shadow-cyan-950/30"
                : "border-white/10 bg-white/[0.035]"
            }`}
          >
            {plan.featured ? (
              <span className="absolute right-4 top-4 rounded-full border border-cyan-200/35 bg-cyan-200/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
                Recommended
              </span>
            ) : null}

            <p className="text-sm font-semibold text-white">{plan.name}</p>
            <div className="mt-4 flex items-end gap-1">
              <span className="text-4xl font-semibold text-white">{plan.price}</span>
              <span className="pb-1 text-sm text-slate-400">{plan.cadence}</span>
            </div>
            <p className="mt-4 min-h-14 text-sm leading-6 text-slate-400">{plan.copy}</p>

            <div className="mt-5 grid gap-2 text-sm text-slate-200">
              <div className="flex items-center gap-2">
                <BadgeCheck size={15} className="shrink-0 text-cyan-100" />
                {plan.packs}
              </div>
              <div className="flex items-center gap-2">
                <BadgeCheck size={15} className="shrink-0 text-cyan-100" />
                {plan.seats}
              </div>
              {plan.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-200" />
                  {feature}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => (plan.id === "free" ? onFreeSelect() : onPlanSelect(plan.id))}
              className={`mt-auto inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition ${
                plan.featured
                  ? "bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                  : "border border-white/10 bg-white/[0.045] text-white hover:border-cyan-200/35"
              }`}
            >
              {plan.cta}
              <ArrowRight size={15} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalSection() {
  return (
    <section className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
      <div className="grid gap-8 rounded-lg border border-white/10 bg-white/[0.035] p-5 sm:p-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-medium text-cyan-100/75">That is the whole product</p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight text-white sm:text-4xl">
            Less content. More confidence.
          </h2>
          <p className="mt-5 text-base leading-8 text-slate-400">
            ProofPitch is not trying to become a heavy workspace. It takes messy product context and
            gives the team one clean, defensible pack.
          </p>
        </div>

        <div className="grid gap-3">
          {[
            "The story is short enough to present.",
            "The proof is visible enough to trust.",
            "The output is ready enough to share.",
          ].map((line) => (
            <div
              key={line}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-slate-200"
            >
              <CheckCircle2 size={16} className="shrink-0 text-emerald-200" />
              {line}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BackgroundPaths() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 proofpitch-ambient" />
      <div className="absolute inset-0 proofpitch-page-grain" />
      <div className="absolute inset-x-0 top-[44%] h-px bg-gradient-to-r from-transparent via-cyan-200/20 to-transparent" />
    </div>
  );
}

function getInitialCheckoutNotice() {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const checkout = params.get("checkout");
  const plan = params.get("plan");

  if (checkout === "success") {
    return `Checkout completed for ${plan ?? "selected plan"}. Entitlements may take a moment to refresh.`;
  }

  if (checkout === "cancelled") {
    return `Checkout cancelled for ${plan ?? "selected plan"}.`;
  }

  return null;
}

export function ProofPitchLanding() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [pendingPlan, setPendingPlan] = useState<CheckoutPlan | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<string | null>(null);
  const [checkoutNotice] = useState<string | null>(getInitialCheckoutNotice);

  async function refreshSession() {
    try {
      const response = await fetch("/api/auth/session");
      const data = await response.json();

      if (response.ok || response.status === 401) {
        setSession(data as SessionPayload);
      }
    } catch {
      setSession(null);
    }
  }

  function focusGenerator() {
    document.getElementById("generator")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => document.getElementById("generator-input")?.focus(), 320);
  }

  async function startCheckout(plan: CheckoutPlan, sessionOverride?: SessionPayload | null) {
    const activeSession = sessionOverride ?? session;

    setPendingPlan(plan);
    focusGenerator();

    if (!activeSession?.user) {
      setAuthMode("signup");
      setCheckoutStatus("Create an account or log in to continue checkout.");
      return;
    }

    setCheckoutStatus("Opening Stripe test checkout...");

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to create checkout session.");
      }

      window.location.href = data.checkoutUrl;
    } catch (error) {
      setCheckoutStatus(error instanceof Error ? error.message : "Unable to create checkout session.");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession((current) =>
      current
        ? {
            ...current,
            user: null,
            organization: null,
          }
        : null,
    );
    setPendingPlan(null);
    setCheckoutStatus(null);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshSession();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main id="top" className="relative min-h-screen bg-[#080b11] text-white">
      <EntryExperience />

      <BackgroundPaths />

      <HeroSection
        session={session}
        authMode={authMode}
        pendingPlan={pendingPlan}
        checkoutStatus={checkoutStatus}
        checkoutNotice={checkoutNotice}
        onAuthModeChange={setAuthMode}
        onAuthSuccess={setSession}
        onLogout={logout}
        onCheckout={startCheckout}
      />

      <div id="proofpitch-scroll">
        <ScrollNarrative />
      </div>

      <PricingSection
        onFreeSelect={() => {
          setPendingPlan(null);
          setCheckoutStatus(null);
          focusGenerator();
        }}
        onPlanSelect={(plan) => void startCheckout(plan)}
      />

      <FinalSection />
    </main>
  );
}
