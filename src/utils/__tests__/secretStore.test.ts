import { describe, it, expect, beforeEach } from 'vitest';
import {
  isStrictLoopbackURL,
  saveSecretApiKey,
  getSecretApiKey,
  removeSecretApiKey,
  clearAllSecretApiKeys,
  sanitizeProfilesForExport,
} from '../secretStore';
import type { ModelProfile } from '../../types';

describe('SecretStore & Security Utilities', () => {
  beforeEach(() => {
    clearAllSecretApiKeys();
  });

  it('should validate strict loopback URLs', () => {
    expect(isStrictLoopbackURL('http://localhost:11434')).toBe(true);
    expect(isStrictLoopbackURL('http://127.0.0.1:11434')).toBe(true);
    expect(isStrictLoopbackURL('http://0.0.0.0:8000')).toBe(true);
    expect(isStrictLoopbackURL('http://[::1]:11434')).toBe(true);
    expect(isStrictLoopbackURL('localhost:11434')).toBe(true);

    // External cloud endpoints
    expect(isStrictLoopbackURL('https://api.openai.com/v1')).toBe(false);
    expect(isStrictLoopbackURL('https://api.anthropic.com')).toBe(false);
    expect(isStrictLoopbackURL('https://api.deepseek.com')).toBe(false);
    expect(isStrictLoopbackURL('http://192.168.1.50:8000')).toBe(false);
  });

  it('should save, retrieve and remove API keys', async () => {
    const profileId = 'prof-test-1';
    const testKey = 'sk-test-secret-literary-key-123456';

    await saveSecretApiKey(profileId, testKey);
    const retrieved = await getSecretApiKey(profileId);
    expect(retrieved).toBe(testKey);

    removeSecretApiKey(profileId);
    const afterRemove = await getSecretApiKey(profileId);
    expect(afterRemove).toBe('');
  });

  it('should clear all stored API keys', async () => {
    await saveSecretApiKey('p1', 'key-1');
    await saveSecretApiKey('p2', 'key-2');

    expect(await getSecretApiKey('p1')).toBe('key-1');
    expect(await getSecretApiKey('p2')).toBe('key-2');

    clearAllSecretApiKeys();

    expect(await getSecretApiKey('p1')).toBe('');
    expect(await getSecretApiKey('p2')).toBe('');
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

