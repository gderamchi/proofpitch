import path from "node:path";

export function outputDirForLaunchPack(launchPackId: string) {
  return path.join(process.cwd(), ".proofpitch", "release-assets", launchPackId);
}

export function renderedDemoVideoPath(launchPackId: string) {
  return path.join(outputDirForLaunchPack(launchPackId), "demo-video.mp4");
}

export function renderedDemoVideoUrl(launchPackId: string) {
  return `/api/launch-packs/${encodeURIComponent(launchPackId)}/video`;
}

export function renderedBrowserRecordingPath(launchPackId: string) {
  return path.join(outputDirForLaunchPack(launchPackId), "browser-recording.webm");
}

export function renderedBrowserRecordingUrl(launchPackId: string) {
  return `/api/launch-packs/${encodeURIComponent(launchPackId)}/recording`;
}

export function renderedVoiceoverSegmentPath(launchPackId: string, segment: string) {
  return path.join(outputDirForLaunchPack(launchPackId), "voiceover", `segment-${segment}.wav`);
}

export function renderedVoiceoverSegmentUrl(launchPackId: string, segment: number) {
  return `/api/launch-packs/${encodeURIComponent(launchPackId)}/voiceover/${segment}`;
}
