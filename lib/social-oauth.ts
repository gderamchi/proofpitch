import { z } from "zod";

export const OAuthProviderSchema = z.enum(["youtube", "linkedin", "x"]);
export type OAuthProvider = z.infer<typeof OAuthProviderSchema>;

type ProviderConfig = {
  clientIdEnv: string;
  clientSecretEnv: string;
  authUrl: string;
  scopes: string[];
};

const CONFIG: Record<OAuthProvider, ProviderConfig> = {
  youtube: {
    clientIdEnv: "YOUTUBE_CLIENT_ID",
    clientSecretEnv: "YOUTUBE_CLIENT_SECRET",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scopes: ["https://www.googleapis.com/auth/youtube.upload"],
  },
  linkedin: {
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    scopes: ["openid", "profile", "w_member_social"],
  },
  x: {
    clientIdEnv: "X_CLIENT_ID",
    clientSecretEnv: "X_CLIENT_SECRET",
    authUrl: "https://twitter.com/i/oauth2/authorize",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access", "media.write"],
  },
};

function originFromRequestUrl(requestUrl: string) {
  const url = new URL(requestUrl);

  return `${url.protocol}//${url.host}`;
}

export function getSocialOAuthHealth() {
  return Object.fromEntries(
    Object.entries(CONFIG).map(([provider, config]) => [
      provider,
      {
        clientIdConfigured: Boolean(process.env[config.clientIdEnv]),
        clientSecretConfigured: Boolean(process.env[config.clientSecretEnv]),
      },
    ]),
  ) as Record<OAuthProvider, { clientIdConfigured: boolean; clientSecretConfigured: boolean }>;
}

export function buildOAuthStartUrl(provider: OAuthProvider, requestUrl: string) {
  const config = CONFIG[provider];
  const clientId = process.env[config.clientIdEnv];

  if (!clientId) {
    throw new Error(`${config.clientIdEnv} is not configured.`);
  }

  const origin = originFromRequestUrl(requestUrl);
  const redirectUri =
    process.env[`${provider.toUpperCase()}_REDIRECT_URI`] ||
    `${origin}/api/oauth/${provider}/callback`;
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: config.scopes.join(" "),
    state,
  });

  if (provider === "youtube") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }

  if (provider === "x") {
    params.set("code_challenge", state.replaceAll("-", ""));
    params.set("code_challenge_method", "plain");
  }

  return {
    provider,
    authorizationUrl: `${config.authUrl}?${params.toString()}`,
    state,
    redirectUri,
    scopes: config.scopes,
  };
}
