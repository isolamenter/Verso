import type { ApiKeyStorageMode, ModelProfile } from '../types';

const SESSION_PREFIX = 'verso_sec_sess_';
const LOCAL_PREFIX = 'verso_sec_enc_';
const CIPHER_VERSION_PREFIX = 'v1';

// In-memory key cache for active session runtime
const inMemoryKeys: Map<string, string> = new Map();

/**
 * Helper to encode/decode Base64 in browser or Node environments
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Validates whether a given URL is strictly a loopback address for Local-only mode.
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
 * Derive AES-GCM 256 Key from user passphrase and salt using PBKDF2 (100,000 iterations, SHA-256)
 */
async function deriveEncryptionKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  if (!passphrase || !passphrase.trim()) {
    throw new Error('密钥加解密必须提供非空的用户主密码/口令 (Passphrase cannot be empty)');
  }

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a secret string using AES-GCM 256 with a unique random Salt & IV per encryption.
 * Output format: v1:<salt_b64>:<iv_b64>:<ciphertext_b64>
 * Strict: Throws error on WebCrypto failure (NO silent Base64 fallback).
 */
export async function encryptSecret(plainText: string, passphrase: string): Promise<string> {
  if (!plainText) return '';
  if (!passphrase || !passphrase.trim()) {
    throw new Error('加密必须指定用户主口令/密码');
  }

  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveEncryptionKey(passphrase, salt);

    const enc = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      enc.encode(plainText)
    );

    const saltB64 = uint8ArrayToBase64(salt);
    const ivB64 = uint8ArrayToBase64(iv);
    const cipherB64 = uint8ArrayToBase64(new Uint8Array(encrypted));

    return `${CIPHER_VERSION_PREFIX}:${saltB64}:${ivB64}:${cipherB64}`;
  } catch (err: any) {
    throw new Error(`WebCrypto 加密失败: ${err?.message || '未知加密异常'}`);
  }
}

/**
 * Decrypt a versioned AES-GCM ciphertext payload.
 * Expects format: v1:<salt_b64>:<iv_b64>:<ciphertext_b64>
 * Strict: Throws error on wrong passphrase or tampered ciphertext.
 */
export async function decryptSecret(cipherPayload: string, passphrase: string): Promise<string> {
  if (!cipherPayload) return '';
  if (!passphrase || !passphrase.trim()) {
    throw new Error('解密必须指定用户主口令/密码');
  }

  const parts = cipherPayload.split(':');
  if (parts.length !== 4 || parts[0] !== CIPHER_VERSION_PREFIX) {
    throw new Error('密文格式不合法或版本不受支持');
  }

  const [, saltB64, ivB64, cipherB64] = parts;

  try {
    const salt = base64ToUint8Array(saltB64);
    const iv = base64ToUint8Array(ivB64);
    const cipherBytes = base64ToUint8Array(cipherB64);

    const key = await deriveEncryptionKey(passphrase, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      cipherBytes as unknown as BufferSource
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (err: any) {
    throw new Error(`解密失败：主口令错误或密文损坏 (${err?.message || 'Decryption failed'})`);
  }
}

/**
 * Set an API key securely according to the chosen storage mode.
 */
export async function saveSecretApiKey(
  profileId: string,
  apiKey: string,
  mode: ApiKeyStorageMode = 'session',
  passphrase?: string
): Promise<void> {
  if (!profileId) return;

  if (!apiKey || !apiKey.trim()) {
    removeSecretApiKey(profileId);
    return;
  }

  const cleanKey = apiKey.trim();
  inMemoryKeys.set(profileId, cleanKey);

  if (mode === 'session') {
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(`${SESSION_PREFIX}${profileId}`, cleanKey);
      } catch {}
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(`${LOCAL_PREFIX}${profileId}`);
      } catch {}
    }
  } else if (mode === 'encrypted_local') {
    if (!passphrase || !passphrase.trim()) {
      throw new Error('持久化加密存储必须提供主密码/口令');
    }
    const encrypted = await encryptSecret(cleanKey, passphrase);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${LOCAL_PREFIX}${profileId}`, encrypted);
    }
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem(`${SESSION_PREFIX}${profileId}`);
      } catch {}
    }
  }
}

/**
 * Retrieve an API key securely.
 */
export async function getSecretApiKey(
  profileId: string,
  passphrase?: string
): Promise<string> {
  if (!profileId) return '';

  // 1. Check in-memory cache
  if (inMemoryKeys.has(profileId)) {
    return inMemoryKeys.get(profileId) || '';
  }

  // 2. Check sessionStorage
  if (typeof sessionStorage !== 'undefined') {
    try {
      const sessionKey = sessionStorage.getItem(`${SESSION_PREFIX}${profileId}`);
      if (sessionKey) {
        inMemoryKeys.set(profileId, sessionKey);
        return sessionKey;
      }
    } catch {}
  }

  // 3. Check encrypted localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      const encrypted = localStorage.getItem(`${LOCAL_PREFIX}${profileId}`);
      if (encrypted && passphrase) {
        const decrypted = await decryptSecret(encrypted, passphrase);
        if (decrypted) {
          inMemoryKeys.set(profileId, decrypted);
          return decrypted;
        }
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
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(`${SESSION_PREFIX}${profileId}`);
    } catch {}
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(`${LOCAL_PREFIX}${profileId}`);
    } catch {}
  }
}

/**
 * Wipes all stored API keys from memory, sessionStorage, and localStorage
 */
export function clearAllSecretApiKeys(): void {
  inMemoryKeys.clear();
  if (typeof sessionStorage !== 'undefined') {
    try {
      const sessionKeysToDelete: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(SESSION_PREFIX)) sessionKeysToDelete.push(k);
      }
      sessionKeysToDelete.forEach((k) => sessionStorage.removeItem(k));
    } catch {}
  }

  if (typeof localStorage !== 'undefined') {
    try {
      const localKeysToDelete: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(LOCAL_PREFIX)) localKeysToDelete.push(k);
      }
      localKeysToDelete.forEach((k) => localStorage.removeItem(k));
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
