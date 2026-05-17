import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve(
  process.env.PROOFPITCH_VIDEO_ASSET_DIR
    ? path.join(process.env.PROOFPITCH_VIDEO_ASSET_DIR, "latest")
    : ".proofpitch/demo-video-assets/latest",
);
const specPath = path.join(outputDir, "hyperframes-spec.json");
const sampleSpec = {
  productName: "ProofPitch",
  oneLiner: "Turn a product URL into a proof-aware demo video with reviewable narration claims.",
  sourceUrl: "https://proofpitch.vercel.app",
  screenshots: [
    {
      title: "Product page",
      url: "https://proofpitch.vercel.app",
      alt: "Public product page capture placeholder",
    },
  ],
  demoSteps: [
    "Open the public product URL.",
    "Show the demo-video form.",
    "Review proof claims that feed captions and voiceover.",
    "Render the HyperFrames MP4.",
  ],
  captions: [
    "Proof-aware demo video.",
    "Accepted claims become narration.",
    "Missing Gradium config uses captions-only.",
  ],
  voiceoverScript:
    "This ProofPitch demo opens the product URL, reviews the claims used for narration, and renders a HyperFrames product walkthrough video.",
  designNotes: "Use ProofPitch's square bordered panels, pale green canvas, readable captions, and restrained teal emphasis.",
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
await writeFile(specPath, JSON.stringify(sampleSpec, null, 2), "utf8");

if (process.env.PROOFPITCH_ENABLE_LOCAL_RENDER !== "1") {
  console.log("Set PROOFPITCH_ENABLE_LOCAL_RENDER=1 to run the HyperFrames video render.");
  console.log(`Prepared sample input in ${outputDir}`);
  process.exit(0);
}

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
