import { describe, it, expect } from 'vitest';
import {
  isStrictLoopbackURL,
  encryptSecret,
  decryptSecret,
  sanitizeProfilesForExport,
} from '../secretStore';
import type { ModelProfile } from '../../types';

describe('SecretStore & Security Utilities', () => {
  it('should validate strict loopback URLs for Local-only mode', () => {
    expect(isStrictLoopbackURL('http://localhost:11434')).toBe(true);
    expect(isStrictLoopbackURL('http://127.0.0.1:11434')).toBe(true);
    expect(isStrictLoopbackURL('http://0.0.0.0:8000')).toBe(true);
    expect(isStrictLoopbackURL('http://[::1]:11434')).toBe(true);
    expect(isStrictLoopbackURL('localhost:11434')).toBe(true);

    // External cloud endpoints must be rejected in local-only mode
    expect(isStrictLoopbackURL('https://api.openai.com/v1')).toBe(false);
    expect(isStrictLoopbackURL('https://api.anthropic.com')).toBe(false);
    expect(isStrictLoopbackURL('https://api.deepseek.com')).toBe(false);
    expect(isStrictLoopbackURL('http://192.168.1.50:8000')).toBe(false);
  });

  it('should encrypt and decrypt secret roundtrip with user passphrase', async () => {
    const rawSecret = 'sk-test-secret-literary-key-123456';
    const passphrase = 'my-secure-author-passphrase';
    const encrypted1 = await encryptSecret(rawSecret, passphrase);
    const encrypted2 = await encryptSecret(rawSecret, passphrase);

    expect(encrypted1).not.toBe(rawSecret);
    expect(encrypted1.startsWith('v1:')).toBe(true);
    // Two encryptions of same secret must produce DIFFERENT ciphertexts due to fresh random Salt & IV
    expect(encrypted1).not.toBe(encrypted2);

    const decrypted = await decryptSecret(encrypted1, passphrase);
    expect(decrypted).toBe(rawSecret);
  });

  it('should reject encryption without passphrase', async () => {
    await expect(encryptSecret('sk-test', '')).rejects.toThrow();
  });

  it('should reject decryption with incorrect passphrase', async () => {
    const rawSecret = 'sk-test-secret-key';
    const encrypted = await encryptSecret(rawSecret, 'correct-passphrase');

    await expect(decryptSecret(encrypted, 'wrong-passphrase')).rejects.toThrow();
  });

  it('should sanitize profiles by stripping API keys for export', () => {
    const mockProfiles: ModelProfile[] = [
      {
        id: 'p1',
        name: 'Profile 1',
        providerType: 'openai',
        model: 'gpt-4o',
        apiKey: 'sk-secret-do-not-leak',
        temperature: 0.3,
        maxTokens: 2000,
      },
      {
        id: 'p2',
        name: 'Profile 2',
        providerType: 'ollama',
        model: 'qwen2.5:32b',
        temperature: 0.2,
        maxTokens: 2048,
      },
    ];

    const sanitized = sanitizeProfilesForExport(mockProfiles);
    expect(sanitized[0].apiKey).toBeUndefined();
    expect(sanitized[1].apiKey).toBeUndefined();
    expect(sanitized[0].name).toBe('Profile 1');
  });
});
