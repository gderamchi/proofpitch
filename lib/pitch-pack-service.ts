import type { User } from "@supabase/supabase-js";

import { renderPitchPackMarkdown } from "./markdown-export";
import {
  getRuntimeBillingMode,
  getRuntimePackLimit,
  normalizePlan,
  type PlanId,
} from "./plans";
import { generatePitchPackWithRunLogs } from "./pitch-pack";
import {
  createLocalProject,
  consumeLocalQuota,
  getLocalPitchPack,
  getLocalQuotaSnapshot,
  listLocalProjects,
  listLocalPitchPacks,
  saveLocalExport,
  saveLocalPitchPack,
  summarizePitchPack,
  updateLocalPitchPack,
} from "./local-store";
import {
  type CreateProjectRequest,
  type GeneratePitchPackRequest,
  type GeneratePitchPackResponse,
  type PitchPack,
  type PitchPackRecord,
  type ProjectSummary,
  type QuotaSnapshot,
  type SourceDocumentSummary,
  type UpdatePitchPackRequest,
} from "./schemas";
import {
  createSupabaseAdminClient,
  createSupabaseRouteClient,
  hasSupabaseAdminEnv,
} from "./supabase/server";

type SupabaseAdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

type OrganizationRow = {
  id: string;
  name: string;
  plan: PlanId | string;
  billing_mode: string | null;
  single_pack_credits: number | null;
};

type SourceDocumentRow = {
  id: string;
  type: SourceDocumentSummary["type"];
  title: string;
  url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type ProviderRunRow = {
  id: string;
  provider: string;
  status: string;
  latency_ms: number | null;
  error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type ExportRow = {
  id: string;
  type: "markdown" | "pdf";
  storage_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type SupabaseContext = {
  source: "supabase";
  admin: SupabaseAdminClient;
  user: User;
  organization: OrganizationRow;
};

type LocalContext = {
  source: "local";
};

type ServiceContext = SupabaseContext | LocalContext;

export class UnauthorizedError extends Error {
  constructor() {
    super("Authentication required.");
  }
}

function getPeriodStart() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function assertSupabaseReady() {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.");
  }

  return admin;
}

export async function getAuthenticatedUser() {
  const supabase = await createSupabaseRouteClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user;
}

async function ensureOrganizationForUser(admin: SupabaseAdminClient, user: User): Promise<OrganizationRow> {
  const { data: memberships, error: membershipError } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1);

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const membership = memberships?.[0] as { organization_id: string } | undefined;

  if (membership) {
    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .select("id,name,plan,billing_mode,single_pack_credits")
      .eq("id", membership.organization_id)
      .single();

    if (organizationError || !organization) {
      throw new Error(organizationError?.message ?? "Organization not found.");
    }

    return organization as OrganizationRow;
  }

  const fallbackName = user.email ? `${user.email.split("@")[0]} workspace` : "Personal workspace";
  const { data: organization, error: insertOrganizationError } = await admin
    .from("organizations")
    .insert({
      name: fallbackName,
      plan: "free",
      billing_mode: getRuntimeBillingMode(),
      created_by: user.id,
    })
    .select("id,name,plan,billing_mode,single_pack_credits")
    .single();

  if (insertOrganizationError || !organization) {
    throw new Error(insertOrganizationError?.message ?? "Unable to create organization.");
  }

  const { error: insertMemberError } = await admin.from("organization_members").insert({
    organization_id: organization.id,
    user_id: user.id,
    role: "owner",
  });

  if (insertMemberError) {
    throw new Error(insertMemberError.message);
  }

  return organization as OrganizationRow;
}

async function getServiceContext(): Promise<ServiceContext> {
  const user = await getAuthenticatedUser();

  if (user && hasSupabaseAdminEnv()) {
    const admin = assertSupabaseReady();
    const organization = await ensureOrganizationForUser(admin, user);

    return {
      source: "supabase",
      admin,
      user,
      organization,
    };
  }

  return {
    source: "local",
  };
}

export async function getRequiredSupabaseContext(): Promise<SupabaseContext> {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  const admin = assertSupabaseReady();
  const organization = await ensureOrganizationForUser(admin, user);

  return {
    source: "supabase",
    admin,
    user,
    organization,
  };
}

function quotaFromUsage({
  organizationId,
  plan,
  billingMode,
  packCount,
  singlePackCredits,
  periodStart,
  source,
}: {
  organizationId: string;
  plan: PlanId;
  billingMode: string;
  packCount: number;
  singlePackCredits: number;
  periodStart: string;
  source: "supabase" | "local";
}): QuotaSnapshot {
  const monthlyLimit = getRuntimePackLimit();

  return {
    organizationId,
    plan,
    billingMode,
    monthlyLimit,
    usedThisPeriod: packCount,
    remaining: Math.max(0, monthlyLimit + singlePackCredits - packCount),
    singlePackCredits,
    periodStart,
    source,
  };
}

async function getSupabaseQuota(ctx: SupabaseContext): Promise<QuotaSnapshot> {
  const periodStart = getPeriodStart();
  const plan = normalizePlan(ctx.organization.plan);
  const { data, error } = await ctx.admin
    .from("usage_counters")
    .select("pack_count")
    .eq("organization_id", ctx.organization.id)
    .eq("period_start", periodStart)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return quotaFromUsage({
    organizationId: ctx.organization.id,
    plan,
    billingMode: getRuntimeBillingMode(),
    packCount: Number((data as { pack_count?: number } | null)?.pack_count ?? 0),
    singlePackCredits: Number(ctx.organization.single_pack_credits ?? 0),
    periodStart,
    source: "supabase",
  });
}

async function consumeSupabaseQuota(ctx: SupabaseContext): Promise<QuotaSnapshot> {
  const quota = await getSupabaseQuota(ctx);

  const nextPackCount = quota.usedThisPeriod + 1;
  const { error } = await ctx.admin.from("usage_counters").upsert(
    {
      organization_id: ctx.organization.id,
      period_start: quota.periodStart,
      pack_count: nextPackCount,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "organization_id,period_start",
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return quotaFromUsage({
    organizationId: ctx.organization.id,
    plan: quota.plan,
    billingMode: quota.billingMode,
    packCount: nextPackCount,
    singlePackCredits: quota.singlePackCredits,
    periodStart: quota.periodStart,
    source: "supabase",
  });
}

async function saveSupabasePitchPack({
  ctx,
  input,
  response,
  quota,
  providerRunLogs,
  sourceDocuments,
}: {
  ctx: SupabaseContext;
  input: GeneratePitchPackRequest;
  response: GeneratePitchPackResponse;
  quota: QuotaSnapshot;
  providerRunLogs: Array<{
    provider: string;
    status: string;
    detail: string;
    latencyMs: number;
    requestId: string;
  }>;
  sourceDocuments: Array<{
    type: SourceDocumentSummary["type"];
    title: string;
    url?: string | null;
    extractedText?: string | null;
    metadata: Record<string, unknown>;
  }>;
}) {
  const { data: project, error: projectError } = await ctx.admin
    .from("projects")
    .insert({
      organization_id: ctx.organization.id,
      name: response.pitchPack.projectName || "Untitled project",
      default_url: input.projectUrl ?? null,
      created_by: ctx.user.id,
    })
    .select("id")
    .single();

  if (projectError || !project) {
    throw new Error(projectError?.message ?? "Unable to create project.");
  }

  const { data: pitchPackRow, error: pitchPackError } = await ctx.admin
    .from("pitch_packs")
    .insert({
      organization_id: ctx.organization.id,
      project_id: project.id,
      status: "completed",
      plan: quota.plan,
      quota,
      input_text: input.rawInput,
      project_url: input.projectUrl ?? null,
      output_json: response.pitchPack,
      created_by: ctx.user.id,
    })
    .select("id,organization_id,project_id,status,plan,quota,created_at")
    .single();

  if (pitchPackError || !pitchPackRow) {
    throw new Error(pitchPackError?.message ?? "Unable to create pitch pack.");
  }

  if (response.pitchPack.claims.length) {
    const { error: claimsError } = await ctx.admin.from("claims").insert(
      response.pitchPack.claims.map((claim) => ({
        pitch_pack_id: pitchPackRow.id,
        text: claim.text,
        status: claim.status,
        source_type: claim.sourceType,
        source_title: claim.sourceTitle ?? null,
        source_url: claim.sourceUrl ?? null,
        explanation: claim.explanation,
      })),
    );

    if (claimsError) {
      throw new Error(claimsError.message);
    }
  }

  if (sourceDocuments.length) {
    const { error: sourceDocumentsError } = await ctx.admin.from("source_documents").insert(
      sourceDocuments.map((document) => ({
        organization_id: ctx.organization.id,
        project_id: project.id,
        pitch_pack_id: pitchPackRow.id,
        type: document.type,
        title: document.title,
        url: document.url ?? null,
        extracted_text: document.extractedText ?? null,
        metadata: document.metadata,
      })),
    );

    if (sourceDocumentsError) {
      throw new Error(sourceDocumentsError.message);
    }
  }

  const { error: providerRunsError } = await ctx.admin.from("provider_runs").insert(
    providerRunLogs.map((run) => ({
      pitch_pack_id: pitchPackRow.id,
      provider: run.provider,
      status: run.status,
      latency_ms: run.latencyMs,
      error: run.status === "failed" ? run.detail : null,
      metadata: {
        detail: run.detail,
        requestId: run.requestId,
      },
    })),
  );

  if (providerRunsError) {
    throw new Error(providerRunsError.message);
  }

  return {
    id: pitchPackRow.id as string,
    organizationId: pitchPackRow.organization_id as string,
    projectId: pitchPackRow.project_id as string,
    status: pitchPackRow.status as "completed",
    plan: normalizePlan(pitchPackRow.plan),
    quota,
    createdAt: pitchPackRow.created_at as string,
  } satisfies PitchPackRecord;
}

export async function getUsageSnapshot() {
  const ctx = await getServiceContext();

  if (ctx.source === "local") {
    return getLocalQuotaSnapshot();
  }

  return getSupabaseQuota(ctx);
}

export async function createPitchPack(input: GeneratePitchPackRequest) {
  const ctx = await getServiceContext();
  const quota =
    ctx.source === "local"
      ? consumeLocalQuota().quota
      : await consumeSupabaseQuota(ctx);

  const { providerRunLogs, sourceDocuments, requestId: _requestId, ...response } =
    await generatePitchPackWithRunLogs(input);
  void _requestId;

  if (ctx.source === "local") {
    const stored = saveLocalPitchPack({
      input,
      response,
      providerRunLogs,
      sourceDocuments,
      quota,
    });

    return stored.response;
  }

  const record = await saveSupabasePitchPack({
    ctx,
    input,
    response,
    quota,
    providerRunLogs,
    sourceDocuments,
  });

  return {
    ...response,
    record,
    quota,
  } satisfies GeneratePitchPackResponse;
}

export async function listPitchPacks() {
  const ctx = await getServiceContext();

  if (ctx.source === "local") {
    return {
      source: "local",
      quota: getLocalQuotaSnapshot(),
      items: listLocalPitchPacks().map((item) =>
        summarizePitchPack(item.id, item.response.pitchPack, item.record),
      ),
    };
  }

  const quota = await getSupabaseQuota(ctx);
  const { data, error } = await ctx.admin
    .from("pitch_packs")
    .select("id,organization_id,project_id,status,plan,output_json,created_at")
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return {
    source: "supabase",
    quota,
    items:
      data?.map((row) => {
        const pitchPack = row.output_json as PitchPack;

        return {
          id: row.id as string,
          organizationId: row.organization_id as string,
          projectId: row.project_id as string | null,
          status: row.status as string,
          plan: normalizePlan(row.plan),
          createdAt: row.created_at as string,
          projectName: pitchPack.projectName,
          oneLiner: pitchPack.oneLiner,
          claimCount: pitchPack.claims.length,
        };
      }) ?? [],
  };
}

export async function listProjects() {
  const ctx = await getServiceContext();

  if (ctx.source === "local") {
    return {
      source: "local",
      items: listLocalProjects(),
    };
  }

  const [{ data: projects, error: projectsError }, { data: pitchPacks, error: pitchPacksError }] =
    await Promise.all([
      ctx.admin
        .from("projects")
        .select("id,name,default_url,created_at")
        .eq("organization_id", ctx.organization.id)
        .order("created_at", { ascending: false }),
      ctx.admin
        .from("pitch_packs")
        .select("project_id,created_at")
        .eq("organization_id", ctx.organization.id),
    ]);

  if (projectsError) {
    throw new Error(projectsError.message);
  }

  if (pitchPacksError) {
    throw new Error(pitchPacksError.message);
  }

  const packRows = (pitchPacks ?? []) as Array<{ project_id: string | null; created_at: string }>;

  return {
    source: "supabase",
    items:
      projects?.map((project) => {
        const projectPacks = packRows.filter((pack) => pack.project_id === project.id);
        const latestPitchPackAt =
          projectPacks
            .map((pack) => pack.created_at)
            .sort()
            .at(-1) ?? null;

        return {
          id: project.id as string,
          name: project.name as string,
          defaultUrl: (project.default_url as string | null) ?? null,
          pitchPackCount: projectPacks.length,
          latestPitchPackAt,
        } satisfies ProjectSummary;
      }) ?? [],
  };
}

export async function createProject(input: CreateProjectRequest) {
  const ctx = await getServiceContext();

  if (ctx.source === "local") {
    return {
      source: "local",
      project: createLocalProject(input),
    };
  }

  const { data, error } = await ctx.admin
    .from("projects")
    .insert({
      organization_id: ctx.organization.id,
      name: input.name,
      default_url: input.defaultUrl ?? null,
      created_by: ctx.user.id,
    })
    .select("id,name,default_url")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create project.");
  }

  return {
    source: "supabase",
    project: {
      id: data.id as string,
      name: data.name as string,
      defaultUrl: (data.default_url as string | null) ?? null,
      pitchPackCount: 0,
      latestPitchPackAt: null,
    } satisfies ProjectSummary,
  };
}

function parseExportStoragePath(storageUrl: string | null | undefined) {
  const prefix = "storage://proofpitch-exports/";

  if (!storageUrl?.startsWith(prefix)) {
    return null;
  }

  return storageUrl.slice(prefix.length);
}

async function mapExportRows(ctx: SupabaseContext, rows: ExportRow[]) {
  const bucket = ctx.admin.storage.from("proofpitch-exports");

  return Promise.all(
    rows.map(async (row) => {
      const path = parseExportStoragePath(row.storage_url);
      let signedUrl: string | null = null;
      let metadata = row.metadata ?? {};

      if (path) {
        const { data, error } = await bucket.createSignedUrl(path, 60 * 60);

        if (error) {
          metadata = {
            ...metadata,
            signedUrlError: error.message,
          };
        } else {
          signedUrl = data.signedUrl;
        }
      }

      return {
        id: row.id,
        type: row.type,
        storageUrl: row.storage_url,
        signedUrl,
        metadata,
        createdAt: row.created_at,
      };
    }),
  );
}

export async function getPitchPackDetail(id: string) {
  const ctx = await getServiceContext();

  if (ctx.source === "local") {
    const stored = getLocalPitchPack(id);

    if (!stored) {
      return null;
    }

    return {
      source: "local",
      record: stored.record,
      pitchPack: stored.response.pitchPack,
      providers: stored.response.providers,
      providerRuns: stored.providerRunLogs.map((run) => ({
        provider: run.provider,
        status: run.status,
        latencyMs: run.latencyMs,
        error: run.status === "failed" ? run.detail : null,
        metadata: {
          detail: run.detail,
          requestId: run.requestId,
        },
      })),
      sourceDocuments: stored.sourceDocuments,
      exports: stored.exports.map(({ content, ...item }) => ({
        ...item,
        storageUrl: null,
        signedUrl: null,
        metadata: {
          size: content.length,
        },
        size: content.length,
      })),
      approvalNote: stored.approvalNote,
    };
  }

  const { data: pitchPackRow, error: pitchPackError } = await ctx.admin
    .from("pitch_packs")
    .select("id,organization_id,project_id,status,plan,quota,output_json,approval_note,created_at")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();

  if (pitchPackError) {
    throw new Error(pitchPackError.message);
  }

  if (!pitchPackRow) {
    return null;
  }

  const [
    { data: sourceDocuments, error: sourceDocumentsError },
    { data: providerRuns, error: providerRunsError },
    { data: exports, error: exportsError },
  ] =
    await Promise.all([
      ctx.admin
        .from("source_documents")
        .select("id,type,title,url,metadata,created_at")
        .eq("pitch_pack_id", id)
        .order("created_at", { ascending: true }),
      ctx.admin
        .from("provider_runs")
        .select("id,provider,status,latency_ms,error,metadata,created_at")
        .eq("pitch_pack_id", id)
        .order("created_at", { ascending: true }),
      ctx.admin
        .from("exports")
        .select("id,type,storage_url,metadata,created_at")
        .eq("pitch_pack_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (sourceDocumentsError) {
    throw new Error(sourceDocumentsError.message);
  }

  if (providerRunsError) {
    throw new Error(providerRunsError.message);
  }

  if (exportsError) {
    throw new Error(exportsError.message);
  }

  return {
    source: "supabase",
    record: {
      id: pitchPackRow.id as string,
      organizationId: pitchPackRow.organization_id as string,
      projectId: pitchPackRow.project_id as string | null,
      status: pitchPackRow.status as "completed",
      plan: normalizePlan(pitchPackRow.plan),
      quota: pitchPackRow.quota as QuotaSnapshot,
      createdAt: pitchPackRow.created_at as string,
    },
    pitchPack: pitchPackRow.output_json as PitchPack,
    providerRuns:
      (providerRuns as ProviderRunRow[] | null)?.map((run) => ({
        id: run.id,
        provider: run.provider,
        status: run.status,
        latencyMs: run.latency_ms,
        error: run.error,
        metadata: run.metadata ?? {},
        createdAt: run.created_at,
      })) ?? [],
    sourceDocuments:
      (sourceDocuments as SourceDocumentRow[] | null)?.map((document) => ({
        id: document.id,
        type: document.type,
        title: document.title,
        url: document.url,
        metadata: document.metadata ?? {},
        createdAt: document.created_at,
      })) ?? [],
    exports: await mapExportRows(ctx, (exports as ExportRow[] | null) ?? []),
    approvalNote: (pitchPackRow.approval_note as string | null) ?? null,
  };
}

export async function updatePitchPack(id: string, input: UpdatePitchPackRequest) {
  const ctx = await getServiceContext();

  if (ctx.source === "local") {
    const updated = updateLocalPitchPack(id, input);

    if (!updated) {
      return null;
    }

    return getPitchPackDetail(id);
  }

  const { data: pitchPackRow, error: pitchPackError } = await ctx.admin
    .from("pitch_packs")
    .select("id,organization_id,project_id,output_json")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();

  if (pitchPackError) {
    throw new Error(pitchPackError.message);
  }

  if (!pitchPackRow) {
    return null;
  }

  const outputJson = pitchPackRow.output_json as PitchPack;
  const nextOutputJson = input.projectName
    ? {
        ...outputJson,
        projectName: input.projectName,
      }
    : outputJson;

  const updatePayload: Record<string, unknown> = {
    output_json: nextOutputJson,
  };

  if (input.approvalNote !== undefined) {
    updatePayload.approval_note = input.approvalNote;
  }

  const { error: updatePitchPackError } = await ctx.admin
    .from("pitch_packs")
    .update(updatePayload)
    .eq("id", id)
    .eq("organization_id", ctx.organization.id);

  if (updatePitchPackError) {
    throw new Error(updatePitchPackError.message);
  }

  if (input.projectName && pitchPackRow.project_id) {
    const { error: updateProjectError } = await ctx.admin
      .from("projects")
      .update({ name: input.projectName })
      .eq("id", pitchPackRow.project_id)
      .eq("organization_id", ctx.organization.id);

    if (updateProjectError) {
      throw new Error(updateProjectError.message);
    }
  }

  return getPitchPackDetail(id);
}

export async function exportPitchPack(id: string, type: "markdown" | "pdf") {
  if (type === "pdf") {
    return {
      status: 501 as const,
      body: {
        error: "PDF export is planned after Markdown export.",
      },
    };
  }

  const ctx = await getServiceContext();
  const detail = await getPitchPackDetail(id);

  if (!detail) {
    return {
      status: 404 as const,
      body: {
        error: "Pitch pack not found.",
      },
    };
  }

  const content = renderPitchPackMarkdown(detail.pitchPack);

  if (ctx.source === "local") {
    const item = saveLocalExport(id, content);

    return {
      status: 200 as const,
      body: {
        source: "local",
        export: item,
        content,
      },
    };
  }

  const path = `${ctx.organization.id}/${id}/${Date.now()}-proofpitch.md`;
  const bucket = ctx.admin.storage.from("proofpitch-exports");
  const { error: uploadError } = await bucket.upload(path, new Blob([content], { type: "text/markdown;charset=utf-8" }), {
    contentType: "text/markdown;charset=utf-8",
    upsert: false,
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: signed, error: signedError } = await bucket.createSignedUrl(path, 60 * 60);

  if (signedError) {
    throw new Error(signedError.message);
  }

  const { data: exportRow, error: exportError } = await ctx.admin
    .from("exports")
    .insert({
      pitch_pack_id: id,
      type: "markdown",
      storage_url: `storage://proofpitch-exports/${path}`,
      metadata: {
        size: content.length,
      },
    })
    .select("id,type,storage_url,metadata,created_at")
    .single();

  if (exportError) {
    throw new Error(exportError.message);
  }

  return {
    status: 200 as const,
    body: {
      source: "supabase",
      export: {
        id: exportRow.id,
        type: exportRow.type,
        storageUrl: exportRow.storage_url,
        metadata: exportRow.metadata,
        createdAt: exportRow.created_at,
      },
      signedUrl: signed.signedUrl,
      content,
    },
  };
}

export async function getSessionPayload() {
  const configured = hasSupabaseAdminEnv();
  const user = await getAuthenticatedUser();

  if (!configured || !user) {
    return {
      configured,
      user: user
        ? {
            id: user.id,
            email: user.email,
          }
        : null,
      organization: null,
      quota: getLocalQuotaSnapshot(),
    };
  }

  const admin = assertSupabaseReady();
  const organization = await ensureOrganizationForUser(admin, user);
  const ctx: SupabaseContext = {
    source: "supabase",
    admin,
    user,
    organization,
  };

  return {
    configured: true,
    user: {
      id: ctx.user.id,
      email: ctx.user.email,
    },
    organization: ctx.organization,
    quota: await getSupabaseQuota(ctx),
  };
}
