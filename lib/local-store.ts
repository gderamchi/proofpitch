import { getBillingMode } from "./plans";
import type {
  CreateProjectRequest,
  ChannelDraft,
  GeneratePitchPackRequest,
  GeneratePitchPackResponse,
  LaunchPack,
  PitchPack,
  PitchPackRecord,
  ProjectSummary,
  QuotaSnapshot,
  SourceDocumentSummary,
  UpdatePitchPackRequest,
} from "./schemas";
import type { ProviderRunLog, SourceDocumentInput } from "./pitch-pack";

type LocalProject = {
  id: string;
  name: string;
  defaultUrl: string | null;
  createdAt: string;
};

export type LocalStoredPitchPack = {
  id: string;
  input: GeneratePitchPackRequest;
  response: GeneratePitchPackResponse;
  record: PitchPackRecord;
  providerRunLogs: ProviderRunLog[];
  sourceDocuments: SourceDocumentSummary[];
  approvalNote: string | null;
  exports: Array<{
    id: string;
    type: "markdown";
    content: string;
    createdAt: string;
  }>;
};

type LocalStore = {
  packCount: number;
  periodStart: string;
  projects: LocalProject[];
  packs: LocalStoredPitchPack[];
  launchPacks: LocalStoredLaunchPack[];
};

export type LocalStoredLaunchPack = {
  id: string;
  launchPack: LaunchPack;
  channelDrafts: ChannelDraft[];
};

const LOCAL_ORGANIZATION_ID = "local-demo";
const DEFAULT_LOCAL_DEMO_PACK_LIMIT = 1000;

const globalStore = globalThis as typeof globalThis & {
  __proofpitchLocalStore?: LocalStore;
};

function getPeriodStart() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function getLocalDemoPackLimit() {
  const parsed = Number.parseInt(process.env.PROOFPITCH_LOCAL_DEMO_PACK_LIMIT ?? "", 10);

  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }

  return DEFAULT_LOCAL_DEMO_PACK_LIMIT;
}

function getStore() {
  const periodStart = getPeriodStart();

  if (!globalStore.__proofpitchLocalStore || globalStore.__proofpitchLocalStore.periodStart !== periodStart) {
    globalStore.__proofpitchLocalStore = {
      packCount: 0,
      periodStart,
      projects: [],
      packs: [],
      launchPacks: [],
    };
  }

  globalStore.__proofpitchLocalStore.projects ??= [];
  globalStore.__proofpitchLocalStore.packs ??= [];
  globalStore.__proofpitchLocalStore.launchPacks ??= [];

  return globalStore.__proofpitchLocalStore;
}

export function getLocalQuotaSnapshot(): QuotaSnapshot {
  const store = getStore();
  const monthlyLimit = getLocalDemoPackLimit();

  return {
    organizationId: LOCAL_ORGANIZATION_ID,
    plan: "free",
    billingMode: getBillingMode(),
    monthlyLimit,
    usedThisPeriod: store.packCount,
    remaining: Math.max(0, monthlyLimit - store.packCount),
    singlePackCredits: 0,
    periodStart: store.periodStart,
    source: "local",
  };
}

export function consumeLocalQuota() {
  const store = getStore();
  const quota = getLocalQuotaSnapshot();

  if (quota.remaining <= 0) {
    return {
      ok: false as const,
      quota,
    };
  }

  store.packCount += 1;

  return {
    ok: true as const,
    quota: getLocalQuotaSnapshot(),
  };
}

export function saveLocalPitchPack({
  input,
  response,
  providerRunLogs,
  sourceDocuments,
  quota,
}: {
  input: GeneratePitchPackRequest;
  response: GeneratePitchPackResponse;
  providerRunLogs: ProviderRunLog[];
  sourceDocuments: SourceDocumentInput[];
  quota: QuotaSnapshot;
}) {
  const store = getStore();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const projectName = response.pitchPack.projectName || "Untitled project";
  let project = store.projects.find(
    (item) => item.name === projectName && item.defaultUrl === (input.projectUrl ?? null),
  );

  if (!project) {
    project = {
      id: crypto.randomUUID(),
      name: projectName,
      defaultUrl: input.projectUrl ?? null,
      createdAt,
    };
    store.projects.unshift(project);
  }

  const record: PitchPackRecord = {
    id,
    organizationId: LOCAL_ORGANIZATION_ID,
    projectId: project.id,
    status: "completed",
    plan: "free",
    quota,
    createdAt,
  };

  const stored: LocalStoredPitchPack = {
    id,
    input,
    response: {
      ...response,
      record,
      quota,
    },
    record,
    providerRunLogs,
    sourceDocuments: sourceDocuments.map((document) => ({
      id: crypto.randomUUID(),
      type: document.type,
      title: document.title,
      url: document.url ?? null,
      metadata: document.metadata,
      createdAt,
    })),
    approvalNote: null,
    exports: [],
  };

  store.packs.unshift(stored);
  store.packs = store.packs.slice(0, 20);

  return stored;
}

export function listLocalPitchPacks() {
  const store = getStore();

  return store.packs;
}

export function getLocalPitchPack(id: string) {
  return getStore().packs.find((pack) => pack.id === id) ?? null;
}

export function listLocalProjects(): ProjectSummary[] {
  const store = getStore();

  return store.projects.map((project) => {
    const projectPacks = store.packs.filter((pack) => pack.record.projectId === project.id);
    const latestPitchPackAt =
      projectPacks
        .map((pack) => pack.record.createdAt)
        .sort()
        .at(-1) ?? null;

    return {
      id: project.id,
      name: project.name,
      defaultUrl: project.defaultUrl,
      pitchPackCount: projectPacks.length,
      latestPitchPackAt,
    };
  });
}

export function createLocalProject(input: CreateProjectRequest): ProjectSummary {
  const store = getStore();
  const createdAt = new Date().toISOString();
  const project: LocalProject = {
    id: crypto.randomUUID(),
    name: input.name,
    defaultUrl: input.defaultUrl ?? null,
    createdAt,
  };

  store.projects.unshift(project);

  return {
    id: project.id,
    name: project.name,
    defaultUrl: project.defaultUrl,
    pitchPackCount: 0,
    latestPitchPackAt: null,
  };
}

export function updateLocalPitchPack(id: string, input: UpdatePitchPackRequest) {
  const store = getStore();
  const pack = getLocalPitchPack(id);

  if (!pack) {
    return null;
  }

  if (input.projectName) {
    pack.response.pitchPack = {
      ...pack.response.pitchPack,
      projectName: input.projectName,
    };

    const project = store.projects.find((item) => item.id === pack.record.projectId);

    if (project) {
      project.name = input.projectName;
    }
  }

  if (input.approvalNote !== undefined) {
    pack.approvalNote = input.approvalNote;
  }

  return pack;
}

export function saveLocalExport(id: string, content: string) {
  const pack = getLocalPitchPack(id);

  if (!pack) {
    return null;
  }

  const item = {
    id: crypto.randomUUID(),
    type: "markdown" as const,
    content,
    createdAt: new Date().toISOString(),
  };
  pack.exports.unshift(item);

  return item;
}

export function summarizePitchPack(id: string, pitchPack: PitchPack, record: PitchPackRecord) {
  return {
    id,
    organizationId: record.organizationId,
    projectId: record.projectId,
    status: record.status,
    plan: record.plan,
    createdAt: record.createdAt,
    projectName: pitchPack.projectName,
    oneLiner: pitchPack.oneLiner,
    claimCount: pitchPack.claims.length,
    generatedMediaUrl: pitchPack.generatedMediaUrl ?? null,
  };
}

export function saveLocalLaunchPack(launchPack: LaunchPack, channelDrafts: ChannelDraft[]) {
  const store = getStore();
  const stored: LocalStoredLaunchPack = {
    id: launchPack.id,
    launchPack,
    channelDrafts,
  };

  store.launchPacks.unshift(stored);
  store.launchPacks = store.launchPacks.slice(0, 20);

  return stored;
}

export function getLocalLaunchPack(id: string) {
  return getStore().launchPacks.find((pack) => pack.id === id) ?? null;
}

export function updateLocalLaunchPackDraft(id: string, draft: ChannelDraft) {
  const stored = getLocalLaunchPack(id);

  if (!stored) {
    return null;
  }

  stored.channelDrafts = stored.channelDrafts.map((item) => (item.id === draft.id ? draft : item));
  stored.launchPack = {
    ...stored.launchPack,
    updatedAt: new Date().toISOString(),
  };

  return stored;
}
