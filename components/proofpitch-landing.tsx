"use client";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clipboard,
  Download,
  ExternalLink,
  FileText,
  Link,
  Loader2,
  RefreshCw,
  Send,
  Video,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { renderPitchPackMarkdown } from "@/lib/markdown-export";
import type { DeckMode, DeckSlideSpec, LaunchPack } from "@/lib/schemas";

const sampleInput = {
  sourceUrl: "https://example.com",
  productName: "ProofPitch",
  targetAudience: "Founder-led B2B teams",
  launchGoal: "Prepare a customer-call demo and concise deck.",
  demoInstructions: "Accept cookies if needed, scroll to the proof moment, then show the core workflow.",
  deckMode: "sales" as DeckMode,
};

const deckModes: Array<{ id: DeckMode; label: string }> = [
  { id: "sales", label: "Sales" },
  { id: "investor", label: "Investor" },
  { id: "launch", label: "Launch" },
];

type RenderDeckResponse = {
  error?: string;
  requiresSignIn?: boolean;
  launchPack?: LaunchPack;
  pitchDeck?: LaunchPack["pitchDeck"];
  render?: {
    enabled: boolean;
    commands: string[];
    artifacts: Array<{
      type: string;
      format: string;
      status: string;
      path: string;
      error?: string;
    }>;
    error?: string;
  };
};

type RenderVideoResponse = {
  error?: string;
  detail?: string;
  launchPack?: LaunchPack;
  videoUrl?: string;
  artifacts?: Array<{
    type?: string;
    status?: string;
  }>;
};

function ProofPitchLogo() {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-stone-900 bg-stone-950">
      <Image
        src="/brand/proofpitch-logo.png"
        width={32}
        height={32}
        alt=""
        className="h-8 w-8 object-contain"
        priority
      />
    </span>
  );
}

function statusTone(status: string) {
  if (status === "ready" || status === "completed") {
    return "border-emerald-800 bg-emerald-50 text-emerald-950";
  }

  if (status === "failed") {
    return "border-red-800 bg-red-50 text-red-950";
  }

  return "border-amber-800 bg-amber-50 text-amber-950";
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function slugFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "proofpitch-deck";
}

function slideTone(layout: DeckSlideSpec["layout"]) {
  if (layout === "proof") {
    return "border-teal-950 bg-[#effaf5]";
  }

  if (layout === "risks") {
    return "border-amber-950 bg-[#fff6df]";
  }

  if (layout === "demo") {
    return "border-sky-950 bg-[#eef8fb]";
  }

  if (layout === "cover") {
    return "border-stone-950 bg-[#0f1f1d] text-white";
  }

  return "border-stone-950 bg-[#fffdf7]";
}

function bodyLines(body: string) {
  return body
    .split(/\n+/)
    .flatMap((line) => line.split(/(?= - )/g))
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean);
}

function visualUrlLabel(url?: string) {
  if (!url) {
    return "product screen";
  }

  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^.*\//, "");
  }
}

function isImageUrl(url?: string) {
  return Boolean(url?.match(/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i) || url?.startsWith("data:image/"));
}

function socialStatusLabel(status: string) {
  if (status === "needs_video") {
    return "Needs video";
  }

  if (status === "needs_deck") {
    return "Needs deck";
  }

  if (status === "manual_step") {
    return "Manual step";
  }

  return "Ready";
}

function socialStatusTone(status: string) {
  if (status === "ready") {
    return "border-emerald-800 bg-emerald-50 text-emerald-950";
  }

  if (status === "manual_step") {
    return "border-sky-800 bg-sky-50 text-sky-950";
  }

  return "border-amber-800 bg-amber-50 text-amber-950";
}

function formatProductHuntDraft(draft: NonNullable<LaunchPack["socialDrafts"]>["productHunt"]) {
  return [
    `Name: ${draft.productName}`,
    `Tagline: ${draft.tagline}`,
    `Description: ${draft.description}`,
    `Launch tags: ${draft.launchTags.join(", ")}`,
    "",
    "First comment:",
    draft.firstComment,
    "",
    `Maker note: ${draft.makerNote}`,
    "",
    "Media checklist:",
    ...draft.mediaChecklist.map((item) => `- ${item}`),
  ].join("\n");
}

function socialDraftTexts(socialDrafts: NonNullable<LaunchPack["socialDrafts"]>) {
  return {
    x: socialDrafts.x.post,
    linkedin: socialDrafts.linkedin.post,
    productHunt: formatProductHuntDraft(socialDrafts.productHunt),
  };
}

function SlideVisualPanel({
  slide,
  lines,
  compact,
}: {
  slide: DeckSlideSpec;
  lines: string[];
  compact: boolean;
}) {
  const visual = slide.visual;
  const cover = slide.layout === "cover";

  if (!visual || compact) {
    return null;
  }

  if (visual.kind === "screenshot") {
    return (
      <div className="relative grid h-full min-h-0 border border-stone-950 bg-white shadow-[6px_6px_0_rgba(17,24,39,0.12)]">
        <div className="flex h-7 items-center gap-1 border-b border-stone-300 bg-stone-100 px-3">
          <span className="h-2 w-2 rounded-full bg-red-400" />
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="ml-2 min-w-0 truncate text-[9px] font-semibold text-stone-500">
            {visualUrlLabel(visual.url)}
          </span>
        </div>
        <div className="relative min-h-0 overflow-hidden bg-[#eef4f1]">
          {isImageUrl(visual.url) ? (
            <div
              aria-label={visual.alt}
              className="h-full bg-cover bg-center"
              style={{ backgroundImage: `url(${visual.url})` }}
            />
          ) : (
            <div className="grid h-full content-center gap-3 p-5">
              <div className="h-2 w-24 bg-teal-800" />
              <div className="grid gap-2">
                <div className="h-4 w-3/4 bg-stone-950" />
                <div className="h-4 w-5/6 bg-stone-800" />
                <div className="h-4 w-2/3 bg-stone-500" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="h-12 border border-stone-400 bg-white" />
                <div className="h-12 border border-stone-400 bg-white" />
                <div className="h-12 border border-stone-400 bg-white" />
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-stone-300 px-3 py-2">
          <p className="line-clamp-1 text-[10px] font-semibold uppercase tracking-normal text-teal-800">
            {visual.title}
          </p>
          {visual.caption ? <p className="line-clamp-1 text-[10px] leading-4 text-stone-500">{visual.caption}</p> : null}
        </div>
      </div>
    );
  }

  if (visual.kind === "claim_stack") {
    return (
      <div className="grid h-full content-start gap-1.5 border border-teal-900 bg-white p-2.5 shadow-[6px_6px_0_rgba(15,118,110,0.16)]">
        <p className="text-[10px] font-semibold uppercase tracking-normal text-teal-800">{visual.title}</p>
        {lines.slice(0, 2).map((line, index) => (
          <div key={line} className="border border-stone-300 bg-[#f7fbf7] p-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-normal text-stone-500">
              Evidence {index + 1}
            </p>
            <p className="line-clamp-2 text-[10px] leading-3 text-stone-800">{line}</p>
          </div>
        ))}
      </div>
    );
  }

  if (visual.kind === "workflow" || visual.kind === "checklist") {
    return (
      <div className="grid h-full content-center gap-2 border border-stone-900 bg-white p-3 shadow-[6px_6px_0_rgba(17,24,39,0.12)]">
        <p className="text-[10px] font-semibold uppercase tracking-normal text-teal-800">{visual.title}</p>
        {lines.slice(0, 4).map((line, index) => (
          <div key={line} className="grid grid-cols-[24px_1fr] items-start gap-2">
            <span className="grid h-6 w-6 place-items-center bg-stone-950 text-[10px] font-semibold text-white">
              {index + 1}
            </span>
            <p className="line-clamp-2 text-[11px] leading-4 text-stone-700">{line}</p>
          </div>
        ))}
      </div>
    );
  }

  if (visual.kind === "risk_stack") {
    return (
      <div className="grid h-full content-center gap-2 border border-amber-900 bg-white p-3 shadow-[6px_6px_0_rgba(146,64,14,0.16)]">
        <p className="text-[10px] font-semibold uppercase tracking-normal text-amber-800">{visual.title}</p>
        {lines.slice(0, 4).map((line) => (
          <div key={line} className="border-l-4 border-amber-700 bg-amber-50 px-2 py-1.5">
            <p className="line-clamp-2 text-[11px] leading-4 text-stone-800">{line}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid h-full content-center gap-3 border p-3 ${cover ? "border-white/25 bg-white/10" : "border-stone-900 bg-white"}`}>
      <div>
        <p className={`text-[10px] font-semibold uppercase tracking-normal ${cover ? "text-teal-200" : "text-teal-800"}`}>
          {visual.kind.replaceAll("_", " ")}
        </p>
        <p className={`mt-2 text-lg font-semibold leading-tight ${cover ? "text-white" : "text-stone-950"}`}>
          {visual.title}
        </p>
      </div>
      {visual.caption ? (
        <p className={`line-clamp-3 text-[11px] leading-4 ${cover ? "text-white/75" : "text-stone-600"}`}>
          {visual.caption}
        </p>
      ) : null}
    </div>
  );
}

function SlideCanvas({
  slide,
  index,
  total,
  productName,
  deckMode,
  compact = false,
}: {
  slide: DeckSlideSpec;
  index: number;
  total: number;
  productName: string;
  deckMode: DeckMode;
  compact?: boolean;
}) {
  const lines = bodyLines(slide.body);
  const cover = slide.layout === "cover";
  const proof = slide.layout === "proof";
  const displayLines = lines.slice(0, proof ? 2 : cover ? 3 : 4);

  return (
    <div
      className={`relative aspect-video overflow-hidden border-2 ${slideTone(slide.layout)} ${
        compact ? "p-2" : "p-5 sm:p-6"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(90deg,#111827_1px,transparent_1px),linear-gradient(#111827_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="relative flex h-full flex-col justify-between gap-3">
        <div className={`flex items-center justify-between gap-3 ${cover ? "text-white/70" : "text-stone-500"}`}>
          <span className={`${compact ? "text-[8px]" : "text-[10px]"} font-semibold uppercase tracking-normal`}>
            {deckMode} deck
          </span>
          <span className={`${compact ? "text-[8px]" : "text-[10px]"} font-semibold uppercase tracking-normal`}>
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>

        <div className={`grid min-h-0 flex-1 gap-3 ${compact ? "" : cover ? "grid-cols-[1fr_0.52fr]" : "grid-cols-[1fr_0.72fr]"}`}>
          <div className="min-w-0 self-center">
            <p
              className={`${compact ? "mb-1 text-[8px]" : "mb-3 text-[10px]"} font-semibold uppercase tracking-normal ${
                cover ? "text-teal-200" : "text-teal-800"
              }`}
            >
              {slide.layout.replaceAll("_", " ")}
            </p>
            <h3
              className={`font-semibold leading-tight ${
                compact ? "line-clamp-2 text-[13px]" : cover ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"
              }`}
            >
              {slide.title}
            </h3>
            <div
              className={`mt-3 grid gap-2 ${
                compact
                  ? "hidden"
                  : proof
                    ? "text-[11px] leading-4 text-stone-800"
                    : cover
                      ? "text-sm leading-6 text-white/85"
                      : "text-xs leading-5 text-stone-700"
              }`}
            >
              {displayLines.map((line) => (
                <p key={line} className={proof || line.length > 126 ? "line-clamp-2" : undefined}>
                  {proof ? "- " : ""}
                  {line}
                </p>
              ))}
            </div>
          </div>

          <SlideVisualPanel slide={slide} lines={lines} compact={compact} />
        </div>

        <div
          className={`flex items-center justify-between gap-3 border-t pt-3 ${
            compact
              ? "hidden"
              : cover
                ? "border-white/20 text-white/65"
                : "hidden"
          }`}
        >
          <span className="text-[10px] font-semibold uppercase tracking-normal">{productName}</span>
          <span className="text-[10px] font-semibold uppercase tracking-normal">ProofPitch</span>
        </div>
      </div>
    </div>
  );
}

function SlideDeckPreview({
  launchPack,
  activeSlideIndex,
  onSelectSlide,
}: {
  launchPack: LaunchPack;
  activeSlideIndex: number;
  onSelectSlide: (index: number) => void;
}) {
  const slides = launchPack.pitchDeck.outline.slides;
  const activeSlide = slides[Math.min(activeSlideIndex, slides.length - 1)] ?? slides[0];

  if (!activeSlide) {
    return null;
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 lg:grid-cols-[128px_1fr]">
        <div className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:max-h-[420px] lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => onSelectSlide(index)}
              className={`w-28 shrink-0 border bg-white p-1 text-left transition lg:w-full ${
                index === activeSlideIndex ? "border-stone-950 shadow-[4px_4px_0_#111827]" : "border-stone-300 hover:border-teal-800"
              }`}
              aria-label={`Show slide ${index + 1}: ${slide.title}`}
            >
              <SlideCanvas
                slide={slide}
                index={index}
                total={slides.length}
                productName={launchPack.productName}
                deckMode={launchPack.deckMode}
                compact
              />
            </button>
          ))}
        </div>

        <SlideCanvas
          slide={activeSlide}
          index={Math.min(activeSlideIndex, slides.length - 1)}
          total={slides.length}
          productName={launchPack.productName}
          deckMode={launchPack.deckMode}
        />
      </div>
    </div>
  );
}

function LaunchAssetsStrip({
  launchPack,
  onCopy,
}: {
  launchPack: LaunchPack;
  onCopy: (text: string) => Promise<void>;
}) {
  const pdfExport = launchPack.pitchDeck.exports.find((item) => item.format === "pdf");
  const pdfUrl = pdfExport?.signedUrl;
  const videoReady = launchPack.demoVideo.status === "ready" && Boolean(launchPack.demoVideo.url);

  return (
    <div className="grid gap-2 border border-stone-300 bg-[#f8fbf8] p-3 text-xs text-stone-700">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 font-semibold text-stone-950">
          <Video size={14} />
          Demo video
        </span>
        <span className={`border px-2 py-1 font-semibold ${statusTone(launchPack.demoVideo.status)}`}>
          {videoReady ? "ready" : launchPack.demoVideo.status}
        </span>
        {launchPack.demoVideo.url ? (
          <>
            <a
              href={launchPack.demoVideo.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 border border-stone-900 bg-white px-2 py-1 font-semibold text-stone-950 transition hover:bg-teal-50"
            >
              <ExternalLink size={13} />
              Open
            </a>
            <a
              href={launchPack.demoVideo.url}
              download
              className="inline-flex items-center gap-1 border border-stone-900 bg-white px-2 py-1 font-semibold text-stone-950 transition hover:bg-teal-50"
            >
              <Download size={13} />
              Download
            </a>
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 font-semibold text-stone-950">
          <FileText size={14} />
          Pitch deck PDF
        </span>
        <span className={`border px-2 py-1 font-semibold ${statusTone(pdfExport?.status ?? "pending")}`}>
          {pdfExport?.status ?? "pending"}
        </span>
        {pdfUrl ? (
          <a
            href={pdfUrl}
            download
            className="inline-flex items-center gap-1 border border-stone-900 bg-white px-2 py-1 font-semibold text-stone-950 transition hover:bg-teal-50"
          >
            <Download size={13} />
            Download
          </a>
        ) : pdfExport?.path ? (
          <span className="truncate text-stone-500">Local: {pdfExport.path}</span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 font-semibold text-stone-950">
          <Link size={14} />
          Product URL
        </span>
        <button
          type="button"
          onClick={() => void onCopy(launchPack.sourceUrl)}
          className="inline-flex items-center gap-1 border border-stone-900 bg-white px-2 py-1 font-semibold text-stone-950 transition hover:bg-teal-50"
        >
          <Clipboard size={13} />
          Copy
        </button>
        <a
          href={launchPack.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 border border-stone-900 bg-white px-2 py-1 font-semibold text-stone-950 transition hover:bg-teal-50"
        >
          <ExternalLink size={13} />
          Open
        </a>
      </div>
    </div>
  );
}

function LaunchTray({
  launchPack,
  onCopy,
  onRefresh,
  isRefreshing,
}: {
  launchPack: LaunchPack;
  onCopy: (text: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
}) {
  const socialDrafts = launchPack.socialDrafts;
  const [activeTab, setActiveTab] = useState<"x" | "linkedin" | "productHunt">("x");
  const [edits, setEdits] = useState(() => (socialDrafts ? socialDraftTexts(socialDrafts) : null));

  if (!socialDrafts || !edits) {
    return (
      <div className="grid gap-3 border border-stone-300 bg-[#f8fbf8] p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-stone-950">Launch tray</p>
            <p className="mt-1 text-xs leading-5 text-stone-600">Social drafts are not generated for this pack yet.</p>
          </div>
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 bg-stone-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Generate
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "x" as const, label: "X", draft: socialDrafts.x, text: edits.x },
    { id: "linkedin" as const, label: "LinkedIn", draft: socialDrafts.linkedin, text: edits.linkedin },
    { id: "productHunt" as const, label: "Product Hunt", draft: socialDrafts.productHunt, text: edits.productHunt },
  ];
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const activeComposerUrl =
    activeTab === "x"
      ? socialDrafts.x.composerUrl
      : activeTab === "linkedin"
        ? socialDrafts.linkedin.composerUrl
        : socialDrafts.productHunt.submitUrl;
  const activeVideoNote =
    activeTab === "x"
      ? socialDrafts.x.videoNote
      : activeTab === "linkedin"
        ? socialDrafts.linkedin.videoNote
        : socialDrafts.productHunt.videoNote;
  const activeDeckNote =
    activeTab === "x"
      ? socialDrafts.x.deckNote
      : activeTab === "linkedin"
        ? socialDrafts.linkedin.deckNote
        : "Keep the deck as a follow-up asset for Product Hunt replies.";

  function updateDraftText(value: string) {
    setEdits((current) => current ? { ...current, [activeTab]: value } : current);
  }

  function openComposer() {
    if (activeTab === "linkedin") {
      void onCopy(active.text).then(() => window.open(activeComposerUrl, "_blank", "noopener,noreferrer"));
      return;
    }

    window.open(activeComposerUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="grid gap-3 border border-stone-300 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-950">Launch tray</p>
          <p className="mt-1 text-xs leading-5 text-stone-600">
            Drafts are ready to copy. Video attachment stays manual in V1.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 border border-stone-900 bg-white px-3 py-2 text-xs font-semibold text-stone-950 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRefreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>

      <LaunchAssetsStrip launchPack={launchPack} onCopy={onCopy} />

      <div className="grid grid-cols-3 border border-stone-300 bg-[#f8fbf8] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-2 py-2 text-xs font-semibold transition ${
              activeTab === tab.id ? "bg-stone-950 text-white" : "text-stone-700 hover:bg-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`border px-2 py-1 text-xs font-semibold ${socialStatusTone(active.draft.status)}`}>
          {socialStatusLabel(active.draft.status)}
        </span>
        <span className="text-xs leading-5 text-stone-600">{activeVideoNote}</span>
      </div>

      <textarea
        value={active.text}
        onChange={(event) => updateDraftText(event.target.value)}
        rows={activeTab === "x" ? 5 : 10}
        className="w-full resize-y border border-stone-300 bg-[#f8fbf8] p-3 text-xs leading-5 text-stone-800 outline-none focus:border-teal-800"
      />

      {activeTab === "productHunt" ? (
        <div className="grid gap-2 border border-stone-300 bg-[#f8fbf8] p-3 text-xs leading-5 text-stone-700">
          <p>
            <span className="font-semibold text-stone-950">Tagline:</span> {socialDrafts.productHunt.tagline}
          </p>
          <p>
            <span className="font-semibold text-stone-950">Description:</span> {socialDrafts.productHunt.description}
          </p>
        </div>
      ) : null}

      <div className="grid gap-1 text-xs leading-5 text-stone-600">
        <p>{activeDeckNote}</p>
        {activeTab === "productHunt" ? <p>Product Hunt video field expects a YouTube URL, so publish the MP4 there first.</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void onCopy(active.text)}
          className="inline-flex items-center gap-2 bg-stone-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-800"
        >
          <Clipboard size={14} />
          Copy draft
        </button>
        <button
          type="button"
          onClick={openComposer}
          className="inline-flex items-center gap-2 border border-stone-900 bg-white px-3 py-2 text-xs font-semibold text-stone-950 transition hover:bg-teal-50"
        >
          <Send size={14} />
          {activeTab === "productHunt" ? "Open Product Hunt" : "Open composer"}
        </button>
      </div>
    </div>
  );
}

function OutputPreview({
  launchPack,
  isGenerating,
  isApproving,
  isRendering,
  acceptedClaimIds,
  renderMessage,
  onToggleClaim,
  onApproveOutline,
  onRenderDeck,
  onCopy,
  onRenderVideo,
  onRefreshSocialDrafts,
  isRenderingVideo,
  isRefreshingDrafts,
  renderState,
}: {
  launchPack: LaunchPack | null;
  isGenerating: boolean;
  isApproving: boolean;
  isRendering: boolean;
  acceptedClaimIds: string[];
  renderMessage: string | null;
  onToggleClaim: (claimId: string) => void;
  onApproveOutline: () => Promise<void>;
  onRenderDeck: () => Promise<void>;
  onCopy: (text: string) => Promise<void>;
  onRenderVideo: () => Promise<void>;
  onRefreshSocialDrafts: () => Promise<void>;
  isRenderingVideo: boolean;
  isRefreshingDrafts: boolean;
  renderState: string | null;
}) {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  if (!launchPack) {
    return (
      <div className="grid min-h-[420px] content-between border-2 border-stone-950 bg-white p-5 shadow-[10px_10px_0_#111827]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-stone-500">Output</p>
          <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-tight text-stone-950">
            A product demo video state and a separate pitch deck.
          </h2>
        </div>
        <div className="grid gap-3">
          {["Product demo status", "Slidev pitch deck", "Claim ledger"].map((item) => (
            <div key={item} className="flex items-center gap-3 border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700">
              <CheckCircle2 size={16} className="text-stone-900" />
              {item}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const outlineReady = launchPack.pitchDeck.outline.status === "ready";
  const pdfExport = launchPack.pitchDeck.exports.find((item) => item.format === "pdf");
  const acceptedSet = new Set(acceptedClaimIds);
  const canApprove = acceptedClaimIds.length > 0 && !outlineReady;
  const slides = launchPack.pitchDeck.outline.slides;
  const currentSlideIndex = slides.length ? Math.min(activeSlideIndex, slides.length - 1) : 0;
  const canGoBack = currentSlideIndex > 0;
  const canGoForward = currentSlideIndex < slides.length - 1;

  return (
    <div className="grid max-h-none min-h-[420px] gap-4 overflow-visible border-2 border-stone-950 bg-white p-5 shadow-[10px_10px_0_#111827] lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-stone-500">
            {outlineReady ? "Outline ready" : "Claim review"}
          </p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight text-stone-950">{launchPack.productName}</h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onCopy(renderPitchPackMarkdown(launchPack.pitchPack))}
            className="inline-flex h-10 w-10 items-center justify-center border border-stone-900 bg-white text-stone-950 transition hover:bg-teal-50"
            title="Copy pitch pack"
            aria-label="Copy pitch pack"
          >
            <Clipboard size={16} />
          </button>
          {launchPack.pitchDeck.markdown ? (
            <button
              type="button"
              onClick={() => onCopy(launchPack.pitchDeck.markdown)}
              className="inline-flex h-10 w-10 items-center justify-center border border-stone-900 bg-stone-950 text-white transition hover:bg-teal-800"
              title="Copy Slidev markdown"
              aria-label="Copy Slidev markdown"
            >
              <FileText size={16} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={`border px-4 py-3 text-sm font-semibold ${statusTone(launchPack.demoVideo.status)}`}>
          Demo video: {launchPack.demoVideo.status}
          <p className="mt-1 text-xs font-normal leading-5">{launchPack.demoVideo.uploadStatus.replaceAll("_", " ")}</p>
        </div>
        <div className="border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-950">
          Deck: {outlineReady ? `${launchPack.pitchDeck.slideCount} slides` : "claims first"}
          <p className="mt-1 text-xs font-normal leading-5 text-stone-600">
            {launchPack.deckMode} / {launchPack.pitchDeck.renderState}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {Object.entries(launchPack.providers).map(([provider, report]) => (
          <div key={provider} className={`border px-3 py-2 text-xs font-semibold ${statusTone(report.state)}`}>
            {provider}: {report.state}
          </div>
        ))}
      </div>

      <LaunchTray
        key={`${launchPack.id}:${launchPack.socialDrafts?.generatedAt ?? "empty"}`}
        launchPack={launchPack}
        onCopy={onCopy}
        onRefresh={onRefreshSocialDrafts}
        isRefreshing={isRefreshingDrafts}
      />

      {launchPack.demoVideo.url ? (
        <div className="grid gap-3">
          <video
            src={launchPack.demoVideo.url}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full border border-stone-900 bg-stone-950"
          />
          <a
            href={launchPack.demoVideo.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-2 border border-stone-900 bg-white px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-teal-50"
          >
            <ExternalLink size={15} />
            Open full-size video
          </a>
        </div>
      ) : (
        <div className="grid gap-3 border border-stone-300 bg-[#f8fbf8] p-3">
          <p className="text-sm leading-6 text-stone-700">
            Let the demo agent handle consent, follow your path instructions, then assemble the walkthrough as a HyperFrames MP4.
          </p>
          <button
            type="button"
            onClick={() => void onRenderVideo()}
            disabled={isRenderingVideo}
            className="inline-flex w-fit items-center gap-2 bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRenderingVideo ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            {isRenderingVideo ? "Rendering video" : "Render demo video"}
          </button>
          {renderState ? <p className="text-sm font-medium text-teal-800">{renderState}</p> : null}
        </div>
      )}

      {launchPack.demoVideo.error && !launchPack.demoVideo.url ? (
        <div className="flex gap-3 border border-amber-800 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
          <AlertCircle size={16} className="mt-1 shrink-0" />
          {launchPack.demoVideo.error}
        </div>
      ) : null}

      {!outlineReady ? (
        <div className="grid gap-3 border border-stone-300 bg-[#f8fbf8] p-3">
          <div>
            <p className="text-sm font-semibold text-stone-950">Approve claims for the deck</p>
            <p className="mt-1 text-xs leading-5 text-stone-600">Unsupported claims stay excluded from Slidev.</p>
          </div>
          <div className="grid gap-2">
            {launchPack.pitchPack.claims.map((claim) => {
              const blocked = claim.status === "unsupported";

              return (
                <label
                  key={claim.id}
                  className={`flex gap-3 border bg-white p-3 text-sm leading-6 ${
                    blocked ? "border-red-200 text-stone-500" : "border-stone-300 text-stone-800"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!blocked && acceptedSet.has(claim.id)}
                    disabled={blocked}
                    onChange={() => onToggleClaim(claim.id)}
                    className="mt-1 h-4 w-4 shrink-0 accent-teal-800"
                  />
                  <span>
                    <span className="block text-[11px] font-semibold uppercase tracking-normal text-teal-800">
                      {claim.status.replaceAll("_", " ")}
                    </span>
                    {claim.text}
                  </span>
                </label>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onApproveOutline}
            disabled={!canApprove || isApproving}
            className="inline-flex w-fit items-center gap-2 bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isApproving ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            Generate outline
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          <SlideDeckPreview
            launchPack={launchPack}
            activeSlideIndex={currentSlideIndex}
            onSelectSlide={setActiveSlideIndex}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveSlideIndex((current) => Math.max(0, current - 1))}
                disabled={!canGoBack}
                className="inline-flex h-10 w-10 items-center justify-center border border-stone-900 bg-white text-stone-950 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40"
                title="Previous slide"
                aria-label="Previous slide"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-stone-700">
                {currentSlideIndex + 1} / {slides.length}
              </span>
              <button
                type="button"
                onClick={() => setActiveSlideIndex((current) => Math.min(slides.length - 1, current + 1))}
                disabled={!canGoForward}
                className="inline-flex h-10 w-10 items-center justify-center border border-stone-900 bg-white text-stone-950 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40"
                title="Next slide"
                aria-label="Next slide"
              >
                <ArrowRight size={16} />
              </button>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadTextFile(`${slugFilename(launchPack.productName)}-${launchPack.deckMode}-slidev.md`, launchPack.pitchDeck.markdown)
              }
              className="inline-flex items-center gap-2 border border-stone-900 bg-white px-4 py-3 text-sm font-semibold text-stone-950 transition hover:bg-teal-50"
            >
              <Download size={16} />
              Download Slidev
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onRenderDeck}
              disabled={isRendering}
              className="inline-flex items-center gap-2 bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRendering ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Render PDF
            </button>
            {pdfExport?.signedUrl ? (
              <a
                href={pdfExport.signedUrl}
                download
                className="inline-flex items-center gap-2 border border-stone-900 bg-white px-4 py-3 text-sm font-semibold text-stone-950 transition hover:bg-teal-50"
              >
                <Download size={16} />
                Download PDF
              </a>
            ) : null}
          </div>
          {pdfExport?.signedUrl ? (
            <iframe
              src={pdfExport.signedUrl}
              title={`${launchPack.productName} pitch deck PDF preview`}
              className="h-56 w-full border border-stone-300 bg-white"
            />
          ) : pdfExport?.path ? (
            <p className="border border-stone-300 bg-[#f8fbf8] p-3 text-xs leading-5 text-stone-600">
              PDF rendered locally at {pdfExport.path}
            </p>
          ) : null}
          {launchPack.pitchDeck.markdown ? (
            <details className="border border-stone-300 bg-[#f8fbf8] p-3 text-xs leading-5 text-stone-700">
              <summary className="cursor-pointer text-sm font-semibold text-stone-950">Slidev markdown</summary>
              <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono">
                {launchPack.pitchDeck.markdown}
              </pre>
            </details>
          ) : null}
        </div>
      )}

      {renderMessage ? (
        <div className="flex gap-3 border border-amber-800 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
          <AlertCircle size={16} className="mt-1 shrink-0" />
          {renderMessage}
        </div>
      ) : null}

      {isGenerating ? (
        <p className="text-sm text-stone-500">Refreshing output...</p>
      ) : null}
    </div>
  );
}

export function ProofPitchLanding() {
  const [sourceUrl, setSourceUrl] = useState(sampleInput.sourceUrl);
  const [productName, setProductName] = useState(sampleInput.productName);
  const [targetAudience, setTargetAudience] = useState(sampleInput.targetAudience);
  const [launchGoal, setLaunchGoal] = useState(sampleInput.launchGoal);
  const [demoInstructions, setDemoInstructions] = useState(sampleInput.demoInstructions);
  const [deckMode, setDeckMode] = useState<DeckMode>(sampleInput.deckMode);
  const [acceptedClaimIds, setAcceptedClaimIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [result, setResult] = useState<LaunchPack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<string | null>(null);
  const [renderMessage, setRenderMessage] = useState<string | null>(null);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [videoRenderMessage, setVideoRenderMessage] = useState<string | null>(null);
  const [isRefreshingDrafts, setIsRefreshingDrafts] = useState(false);

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsGenerating(true);
    setError(null);
    setCopyState(null);
    setRenderMessage(null);
    setVideoRenderMessage(null);

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
          deckMode,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Release pack generation failed.");
      }

      const launchPack = data as LaunchPack;
      setResult(launchPack);
      setAcceptedClaimIds(launchPack.claimReview.acceptedClaimIds);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Release pack generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setCopyState("Copied");
    window.setTimeout(() => setCopyState(null), 1500);
  }

  function toggleClaim(claimId: string) {
    setAcceptedClaimIds((current) =>
      current.includes(claimId) ? current.filter((id) => id !== claimId) : [...current, claimId],
    );
  }

  async function approveOutline() {
    if (!result) {
      return;
    }

    setIsApproving(true);
    setError(null);
    setRenderMessage(null);
    setVideoRenderMessage(null);

    try {
      const response = await fetch(`/api/launch-packs/${result.id}/outline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ acceptedClaimIds, launchPack: result }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail ?? data?.error ?? "Deck outline approval failed.");
      }

      setResult(data as LaunchPack);
    } catch (outlineError) {
      setError(outlineError instanceof Error ? outlineError.message : "Deck outline approval failed.");
    } finally {
      setIsApproving(false);
    }
  }

  async function renderDeck() {
    if (!result) {
      return;
    }

    setIsRendering(true);
    setError(null);
    setRenderMessage(null);
    setVideoRenderMessage(null);

    try {
      const response = await fetch(`/api/launch-packs/${result.id}/render`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dryRun: false, launchPack: result }),
      });
      const data = (await response.json()) as RenderDeckResponse;

      if (!response.ok) {
        setRenderMessage(data?.error ?? "PDF export requires sign-in or a configured render worker.");
        return;
      }

      setResult((current) => data.launchPack ?? (current && data.pitchDeck ? { ...current, pitchDeck: data.pitchDeck } : current));
      if (data.render && !data.render.enabled) {
        setRenderMessage(
          "PDF render is disabled in this environment. Set PROOFPITCH_ENABLE_LOCAL_RENDER=1 to render locally.",
        );
      } else if (data.render?.error) {
        setRenderMessage(data.render.error);
      }
    } catch (renderError) {
      setRenderMessage(renderError instanceof Error ? renderError.message : "PDF render failed.");
    } finally {
      setIsRendering(false);
    }
  }

  async function renderDemoVideo() {
    if (!result) {
      return;
    }

    setIsRenderingVideo(true);
    setVideoRenderMessage("Capturing the site and rendering with HyperFrames...");
    setError(null);
    setRenderMessage(null);

    try {
      const response = await fetch(`/api/launch-packs/${result.id}/render`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          captureSite: true,
          dryRun: false,
          launchPack: result,
          renderDeck: false,
          renderVideo: true,
        }),
      });
      const data = (await response.json()) as RenderVideoResponse;

      if (!response.ok || data.error) {
        throw new Error(data.detail ?? data.error ?? "Video render failed.");
      }

      const videoArtifact = Array.isArray(data.artifacts)
        ? data.artifacts.find((artifact: { type?: string }) => artifact.type === "video")
        : null;

      if (!videoArtifact || videoArtifact.status !== "ready") {
        throw new Error(data.error ?? "Video render did not finish.");
      }

      const videoUrl = data.videoUrl ?? `/api/launch-packs/${result.id}/video`;

      setResult(
        data.launchPack
          ? {
              ...data.launchPack,
              demoVideo: {
                ...data.launchPack.demoVideo,
                url: videoUrl,
              },
            }
          : {
              ...result,
              demoVideo: {
                ...result.demoVideo,
                status: "ready",
                durationSeconds: 24,
                uploadStatus: "not_required",
                url: videoUrl,
                error: undefined,
              },
              updatedAt: new Date().toISOString(),
            },
      );
      setVideoRenderMessage("Demo video rendered.");
    } catch (renderError) {
      const message = renderError instanceof Error ? renderError.message : "Video render failed.";

      setError(message);
      setVideoRenderMessage(null);
    } finally {
      setIsRenderingVideo(false);
    }
  }

  async function refreshSocialDrafts() {
    if (!result) {
      return;
    }

    setIsRefreshingDrafts(true);
    setError(null);
    setRenderMessage(null);
    setVideoRenderMessage(null);

    try {
      const response = await fetch(`/api/launch-packs/${result.id}/social-drafts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ launchPack: result }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail ?? data?.error ?? "Social draft refresh failed.");
      }

      setResult(data as LaunchPack);
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : "Social draft refresh failed.");
    } finally {
      setIsRefreshingDrafts(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#edf4f1] text-stone-950">
      <section className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-8">
        <div className="grid gap-5">
          <nav className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ProofPitchLogo />
              <div>
                <p className="text-sm font-semibold">ProofPitch</p>
                <p className="text-xs text-stone-500">demo + deck</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSourceUrl(sampleInput.sourceUrl);
                setProductName(sampleInput.productName);
                setTargetAudience(sampleInput.targetAudience);
                setLaunchGoal(sampleInput.launchGoal);
                setDemoInstructions(sampleInput.demoInstructions);
                setDeckMode(sampleInput.deckMode);
              }}
              className="border border-stone-900 bg-white px-3 py-2 text-xs font-semibold transition hover:bg-teal-50"
            >
              Load sample
            </button>
          </nav>

          <div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[0.96] text-stone-950 sm:text-5xl lg:text-6xl">
              Product URL to product demo video and pitch deck.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
              ProofPitch now uses a small demo agent: it handles cookie walls, follows your path
              instructions, then turns that walkthrough into a HyperFrames video.
            </p>
          </div>

          <form onSubmit={handleGenerate} className="grid gap-3 border-2 border-stone-950 bg-white p-3">
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              className="border border-stone-300 bg-[#f8fbf8] px-3 py-3 text-sm outline-none focus:border-teal-800"
              placeholder="Public product URL"
              type="url"
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={productName}
                onChange={(event) => setProductName(event.target.value)}
                className="border border-stone-300 bg-[#f8fbf8] px-3 py-3 text-sm outline-none focus:border-teal-800"
                placeholder="Product name"
                required
              />
              <input
                value={targetAudience}
                onChange={(event) => setTargetAudience(event.target.value)}
                className="border border-stone-300 bg-[#f8fbf8] px-3 py-3 text-sm outline-none focus:border-teal-800"
                placeholder="Target audience"
                required
              />
            </div>
            <textarea
              value={launchGoal}
              onChange={(event) => setLaunchGoal(event.target.value)}
              rows={2}
              className="resize-none border border-stone-300 bg-[#f8fbf8] px-3 py-3 text-sm leading-6 outline-none focus:border-teal-800"
              placeholder="Goal"
              required
            />
            <textarea
              value={demoInstructions}
              onChange={(event) => setDemoInstructions(event.target.value)}
              rows={2}
              className="resize-none border border-stone-300 bg-[#f8fbf8] px-3 py-3 text-sm leading-6 outline-none focus:border-teal-800"
              placeholder="Demo path, e.g. accept cookies, search Pricing, open the first result, scroll to the CTA"
            />
            <div className="grid gap-2">
              <div className="grid grid-cols-3 border border-stone-300 bg-[#f8fbf8] p-1">
                {deckModes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setDeckMode(mode.id)}
                    className={`px-3 py-2 text-sm font-semibold transition ${
                      deckMode === mode.id ? "bg-stone-950 text-white" : "text-stone-700 hover:bg-white"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isGenerating}
                className="inline-flex items-center gap-2 bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {isGenerating ? "Generating" : "Generate MVP pack"}
              </button>
              {copyState ? <span className="text-sm font-medium text-teal-800">{copyState}</span> : null}
              {error ? <span className="text-sm font-medium text-red-800">{error}</span> : null}
            </div>
          </form>
        </div>

        <OutputPreview
          key={result?.id ?? "empty-output"}
          launchPack={result}
          isGenerating={isGenerating}
          isApproving={isApproving}
          isRendering={isRendering}
          acceptedClaimIds={acceptedClaimIds}
          renderMessage={renderMessage}
          onToggleClaim={toggleClaim}
          onApproveOutline={approveOutline}
          onRenderDeck={renderDeck}
          onCopy={copyText}
          onRenderVideo={renderDemoVideo}
          onRefreshSocialDrafts={refreshSocialDrafts}
          isRenderingVideo={isRenderingVideo}
          isRefreshingDrafts={isRefreshingDrafts}
          renderState={videoRenderMessage}
        />
      </section>
    </main>
  );
}
