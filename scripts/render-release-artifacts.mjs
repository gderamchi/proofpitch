import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
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

Release-ready pitch decks, demo videos, voiceovers, and posts.

---

## Product

ProofPitch turns product context into a release pack.

---

## Demo

Render this sample deck with Slidev and this sample video with Remotion.
`;
const sampleProps = {
  productName: "ProofPitch",
  oneLiner: "Release-ready decks, demo videos, voiceovers, and posts from one reviewed product story.",
  sourceUrl: "https://example.com",
  deckTitle: "ProofPitch release deck",
  slideCount: 3,
  captions: ["Sample release render"],
  scenes: [
    {
      kind: "hook",
      title: "ProofPitch",
      body: "Release-ready decks, demo videos, voiceovers, and posts.",
    },
    {
      kind: "problem",
      title: "Problem",
      body: "Teams need credible release assets before they can sell.",
    },
    {
      kind: "solution",
      title: "Solution",
      body: "ProofPitch creates the approved release pack.",
    },
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
  "ProofPitchReleaseDemo",
  path.join(outputDir, "demo-video.mp4"),
  "--props",
  propsPath,
]);
