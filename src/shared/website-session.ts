export type WebsiteSessionPayload = {
  token?: unknown;
  profile: unknown;
};

export function buildWebsiteSessionPayload(data: unknown): WebsiteSessionPayload | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const session = data as { valid?: boolean; token?: { access_token?: string } };
  if (session.valid !== true) {
    return null;
  }

  return {
    ...(session.token?.access_token ? { token: session.token } : {}),
    profile: data,
  };
}
