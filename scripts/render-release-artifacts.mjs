import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDir = process.env.PROOFPITCH_RELEASE_ASSET_DIR
  ? path.join(process.env.PROOFPITCH_RELEASE_ASSET_DIR, "latest")
  : ".proofpitch/release-assets/latest";
const deckPath = path.join(outputDir, "pitch-deck.md");
const propsPath = path.join(outputDir, "remotion-props.json");
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
const sampleProps = {
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
await writeFile(propsPath, JSON.stringify(sampleProps, null, 2), "utf8");

if (process.env.PROOFPITCH_ENABLE_LOCAL_RENDER !== "1") {
  console.log("Set PROOFPITCH_ENABLE_LOCAL_RENDER=1 to run Slidev and Remotion renders.");
  console.log(`Prepared sample inputs in ${outputDir}`);
  process.exit(0);
}

await run("npx", ["@slidev/cli", "export", deckPath, "--format", "pdf", "--output", path.join(outputDir, "pitch-deck.pdf")]);
await run("npx", [
  "remotion",
  "render",
  "remotion/index.tsx",
  "ProofPitchProductDemo",
  path.join(outputDir, "demo-video.mp4"),
  "--props",
  propsPath,
]);
