import type { ModelProfile } from '../types';

const KEY_PREFIX = 'verso_api_key_';
const SESSION_PREFIX = 'verso_sec_sess_';
const LOCAL_ENC_PREFIX = 'verso_sec_enc_';

// In-memory key cache for active session runtime
const inMemoryKeys: Map<string, string> = new Map();

/**
 * Validates whether a given URL is strictly a loopback address.
 */
export function isStrictLoopbackURL(urlString?: string): boolean {
  if (!urlString || !urlString.trim()) return true;
  let target = urlString.trim().toLowerCase();

  // If protocol is missing, prepend http:// to parse hostname
  if (!target.startsWith('http://') && !target.startsWith('https://')) {
    target = 'http://' + target;
  }

  try {
    const url = new URL(target);
    const host = url.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '[::1]' ||
      host.endsWith('.localhost')
    );
  } catch {
    const trimmed = urlString.trim().toLowerCase();
    return (
      trimmed.startsWith('localhost') ||
      trimmed.startsWith('http://localhost') ||
      trimmed.startsWith('http://127.0.0.1')
    );
  }
}

/**
 * Set an API key securely in browser local storage and memory cache.
 */
export async function saveSecretApiKey(
  profileId: string,
  apiKey: string
): Promise<void> {
  if (!profileId) return;

  if (!apiKey || !apiKey.trim()) {
    removeSecretApiKey(profileId);
    return;
  }

  const cleanKey = apiKey.trim();
  inMemoryKeys.set(profileId, cleanKey);

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(`${KEY_PREFIX}${profileId}`, cleanKey);
    } catch {}
  }
}

/**
 * Retrieve an API key.
 */
export async function getSecretApiKey(
  profileId: string
): Promise<string> {
  if (!profileId) return '';

  // 1. Check in-memory cache
  if (inMemoryKeys.has(profileId)) {
    return inMemoryKeys.get(profileId) || '';
  }

  // 2. Check localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      const localKey = localStorage.getItem(`${KEY_PREFIX}${profileId}`);
      if (localKey) {
        inMemoryKeys.set(profileId, localKey);
        return localKey;
      }
    } catch {}
  }

  // 3. Fallback check sessionStorage
  if (typeof sessionStorage !== 'undefined') {
    try {
      const sessionKey = sessionStorage.getItem(`${SESSION_PREFIX}${profileId}`);
      if (sessionKey) {
        inMemoryKeys.set(profileId, sessionKey);
        return sessionKey;
      }
    } catch {}
  }

  return '';
}

/**
 * Remove a specific API key
 */
export function removeSecretApiKey(profileId: string): void {
  inMemoryKeys.delete(profileId);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(`${KEY_PREFIX}${profileId}`);
      localStorage.removeItem(`${LOCAL_ENC_PREFIX}${profileId}`);
    } catch {}
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(`${SESSION_PREFIX}${profileId}`);
    } catch {}
  }
}

/**
 * Wipes all stored API keys from memory, sessionStorage, and localStorage
 */
export function clearAllSecretApiKeys(): void {
  inMemoryKeys.clear();
  if (typeof localStorage !== 'undefined') {
    try {
      const localKeysToDelete: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith(KEY_PREFIX) ||
            k.startsWith(SESSION_PREFIX) ||
            k.startsWith(LOCAL_ENC_PREFIX))
        ) {
          localKeysToDelete.push(k);
        }
      }
      localKeysToDelete.forEach((k) => localStorage.removeItem(k));
    } catch {}
  }

  if (typeof sessionStorage !== 'undefined') {
    try {
      const sessionKeysToDelete: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (
          k &&
          (k.startsWith(KEY_PREFIX) ||
            k.startsWith(SESSION_PREFIX) ||
            k.startsWith(LOCAL_ENC_PREFIX))
        ) {
          sessionKeysToDelete.push(k);
        }
      }
      sessionKeysToDelete.forEach((k) => sessionStorage.removeItem(k));
    } catch {}
  }
}

/**
 * Strip sensitive credentials for export / sharing
 */
export function sanitizeProfilesForExport(profiles: ModelProfile[]): ModelProfile[] {
  return profiles.map((p) => {
    const copy = { ...p };
    delete copy.apiKey;
    return copy;
  });
}

