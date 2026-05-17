import type { User } from "@supabase/supabase-js";

import { createSupabaseAdminClient, createSupabaseRouteClient, hasSupabaseAdminEnv } from "./supabase/server";

type SupabaseAdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

export type OrganizationRow = {
  id: string;
  name: string;
  created_by?: string | null;
};

export type SupabaseContext = {
  source: "supabase";
  admin: SupabaseAdminClient;
  user: User;
  organization: OrganizationRow;
};

export class UnauthorizedError extends Error {
  constructor() {
    super("Authentication required.");
  }
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
      .select("id,name,created_by")
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
      created_by: user.id,
    })
    .select("id,name,created_by")
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

export async function getOptionalSupabaseContext(): Promise<SupabaseContext | null> {
  if (!hasSupabaseAdminEnv()) {
    return null;
  }

  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
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
    };
  }

  const admin = assertSupabaseReady();
  const organization = await ensureOrganizationForUser(admin, user);

  return {
    configured: true,
    user: {
      id: user.id,
      email: user.email,
    },
    organization,
  };
}
