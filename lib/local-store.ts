import type {
  DemoVideoProject,
  SourceDocumentSummary,
} from "./schemas";
import type { ProviderRunLog, SourceDocumentInput } from "./demo-brief";

export type LocalStoredDemoVideoProject = {
  id: string;
  project: DemoVideoProject;
  providerRunLogs: ProviderRunLog[];
  sourceDocuments: SourceDocumentSummary[];
};

type LocalStore = {
  demoVideoProjects: LocalStoredDemoVideoProject[];
};

const globalStore = globalThis as typeof globalThis & {
  __proofpitchLocalStore?: LocalStore;
};

function getStore() {
  if (!globalStore.__proofpitchLocalStore) {
    globalStore.__proofpitchLocalStore = {
      demoVideoProjects: [],
    };
  }

  globalStore.__proofpitchLocalStore.demoVideoProjects ??= [];

  return globalStore.__proofpitchLocalStore;
}

export function saveLocalDemoVideoProject({
  project,
  providerRunLogs = [],
  sourceDocuments = [],
}: {
  project: DemoVideoProject;
  providerRunLogs?: ProviderRunLog[];
  sourceDocuments?: SourceDocumentInput[];
}) {
  const store = getStore();
  const createdAt = project.createdAt;
  const stored: LocalStoredDemoVideoProject = {
    id: project.id,
    project,
    providerRunLogs,
    sourceDocuments: sourceDocuments.map((document) => ({
      id: crypto.randomUUID(),
      type: document.type,
      title: document.title,
      url: document.url ?? null,
      metadata: document.metadata,
      createdAt,
    })),
  };

  store.demoVideoProjects = [
    stored,
    ...store.demoVideoProjects.filter((item) => item.id !== project.id),
  ].slice(0, 20);

  return stored;
}

export function updateLocalDemoVideoProject(project: DemoVideoProject) {
  const store = getStore();
  const stored = store.demoVideoProjects.find((item) => item.id === project.id);

  if (!stored) {
    return false;
  }

  stored.project = project;
  return true;
}

export function getLocalDemoVideoProject(id: string) {
  return getStore().demoVideoProjects.find((project) => project.id === id) ?? null;
}

export function resetLocalStoreForTests() {
  globalStore.__proofpitchLocalStore = {
    demoVideoProjects: [],
  };
}
