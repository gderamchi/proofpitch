import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve(
  process.env.PROOFPITCH_RELEASE_ASSET_DIR
    ? path.join(process.env.PROOFPITCH_RELEASE_ASSET_DIR, "latest")
    : ".proofpitch/release-assets/latest",
);
const deckPath = path.join(outputDir, "pitch-deck.md");
const specPath = path.join(outputDir, "hyperframes-spec.json");
const sampleDeck = `---
theme: default
title: "ProofPitch release deck"
---

# ProofPitch

Product URL to product demo path and separate pitch deck.

---

## Product

ProofPitch turns public product context into an evidence-backed MVP pack.

---

## Product Demo

The demo video is generated from product walkthrough capture only.
`;
const sampleSpec = {
  productName: "ProofPitch",
  oneLiner: "Turn a product URL into a product demo path, separate pitch deck, and claim ledger.",
  sourceUrl: "https://example.com",
  screenshots: [
    {
      title: "Product page",
      url: "https://example.com",
      alt: "Public product page capture placeholder",
    },
  ],
  demoSteps: [
    "Open the public product URL.",
    "Show the primary product workflow.",
    "Pause on the strongest proof moment.",
  ],
  captions: [
    "Product demo and pitch deck stay separate.",
    "Claims stay reviewable before sharing.",
  ],
  designNotes: "Use ProofPitch's square bordered panels, pale green canvas, and restrained teal emphasis.",
  researchSummary: "Sample local render fixture.",
};

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

await mkdir(outputDir, { recursive: true });
await writeFile(deckPath, sampleDeck, "utf8");
await writeFile(specPath, JSON.stringify(sampleSpec, null, 2), "utf8");

if (process.env.PROOFPITCH_ENABLE_LOCAL_RENDER !== "1") {
  console.log("Set PROOFPITCH_ENABLE_LOCAL_RENDER=1 to run Slidev and HyperFrames renders.");
  console.log(`Prepared sample inputs in ${outputDir}`);
  process.exit(0);
}

await run("npx", ["@slidev/cli", "export", deckPath, "--format", "pdf", "--output", path.join(outputDir, "pitch-deck.pdf")]);
await run("npm", [
  "--prefix",
  "hyperframes/proofpitch-demo",
  "run",
  "render",
  "--",
  "--output",
  path.join(outputDir, "demo-video.mp4"),
  "--quality",
  "standard",
  "--workers",
  "1",
]);
