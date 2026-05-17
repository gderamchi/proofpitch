import { describe, expect, it } from "vitest";

import {
  getLocalDemoVideoProject,
  resetLocalStoreForTests,
  saveLocalDemoVideoProject,
  updateLocalDemoVideoProject,
} from "../lib/local-store";
import { DemoVideoProjectSchema, type DemoVideoProject } from "../lib/schemas";

function buildProject(id = "local-demo"): DemoVideoProject {
  const now = new Date().toISOString();

  return DemoVideoProjectSchema.parse({
    id,
    status: "running",
    sourceUrl: "https://example.com",
    productName: "ProofPitch",
    targetAudience: "Founder-led B2B teams",
    demoGoal: "Show the generated demo flow.",
    proofReview: {
      status: "approved",
      acceptedClaimIds: ["claim-1"],
      rejectedClaimIds: [],
    },
    demoBrief: {
      projectName: "ProofPitch",
      oneLiner: "Proof-aware demo video.",
      targetUser: "Founder-led B2B teams",
      demoNarrative: "Show the product workflow.",
      demoScript2Min: "Open the product and narrate the generated walkthrough.",
      demoSteps: ["Open the product."],
      claims: [
        {
          id: "claim-1",
          text: "The demo uses the submitted URL.",
          status: "user_provided",
          sourceType: "user_input",
          sourceTitle: "Request",
          sourceUrl: null,
          explanation: "The URL is provided by the user.",
        },
      ],
      providerUsage: {
        openai: "",
        tavily: "",
        pioneer: "",
      },
      risks: [],
      nextSteps: [],
    },
    captions: ["Proof-aware demo video."],
    screenshots: [],
    demoVideo: {
      status: "pending",
      uploadStatus: "pending",
      renderer: "hyperframes",
    },
    voiceover: {
      status: "pending",
      provider: "gradium",
      script: "Open the product and narrate the generated walkthrough.",
    },
    providers: {
      openai: { state: "missing", detail: "missing" },
      tavily: { state: "missing", detail: "missing" },
      pioneer: { state: "missing", detail: "missing" },
    },
    createdAt: now,
    updatedAt: now,
  });
}

describe("local demo-video store", () => {
  it("saves, reads, and updates demo video projects without quota state", () => {
    resetLocalStoreForTests();
    const project = buildProject();

    saveLocalDemoVideoProject({ project });
    expect(getLocalDemoVideoProject(project.id)?.project.productName).toBe("ProofPitch");

    const updated = {
      ...project,
      status: "completed" as const,
      demoVideo: {
        ...project.demoVideo,
        status: "ready" as const,
        url: "/api/demo-videos/local-demo/video",
        uploadStatus: "not_required" as const,
      },
    };

    expect(updateLocalDemoVideoProject(updated)).toBe(true);
    expect(getLocalDemoVideoProject(project.id)?.project.demoVideo.url).toBe("/api/demo-videos/local-demo/video");
    expect(getLocalDemoVideoProject("missing")).toBeNull();
  });
});
