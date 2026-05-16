"use client";

import { AlertCircle, ArrowRight, CheckCircle2, Clipboard, Download, FileText, Loader2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { renderPitchPackMarkdown } from "@/lib/markdown-export";
import type { DeckMode, LaunchPack } from "@/lib/schemas";

const sampleInput = {
  sourceUrl: "https://example.com",
  productName: "ProofPitch",
  targetAudience: "Founder-led B2B teams",
  launchGoal: "Prepare a customer-call demo and concise deck.",
  demoInstructions: "Show the core workflow and proof moment.",
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
}) {
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

      {launchPack.demoVideo.error ? (
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
          <div className="grid gap-2">
            {launchPack.pitchDeck.outline.slides.map((slide, index) => (
              <div key={slide.id} className="border border-stone-300 bg-white p-3">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-normal text-teal-800">
                  {String(index + 1).padStart(2, "0")} / {slide.layout.replaceAll("_", " ")}
                </div>
                <p className="text-sm font-semibold text-stone-950">{slide.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-stone-600">{slide.body}</p>
              </div>
            ))}
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

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsGenerating(true);
    setError(null);
    setCopyState(null);
    setRenderMessage(null);

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

    try {
      const response = await fetch(`/api/launch-packs/${result.id}/render`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dryRun: false }),
      });
      const data = (await response.json()) as RenderDeckResponse;

      if (!response.ok) {
        setRenderMessage(data?.error ?? "PDF export requires sign-in or a configured render worker.");
        return;
      }

      setResult((current) =>
        current && data.pitchDeck
          ? {
              ...current,
              pitchDeck: data.pitchDeck,
            }
          : current,
      );
      if (data.render?.error) {
        setRenderMessage(data.render.error);
      }
    } catch (renderError) {
      setRenderMessage(renderError instanceof Error ? renderError.message : "PDF render failed.");
    } finally {
      setIsRendering(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#edf4f1] text-stone-950 lg:overflow-hidden">
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
              ProofPitch keeps the product demo separate from the deck and flags claims before anything is shared.
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
              placeholder="Product demo path"
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
        />
      </section>
    </main>
  );
}
