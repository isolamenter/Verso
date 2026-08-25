import React, { useState, useEffect } from 'react';
import type {
  ModelProfile,
  AppSettings,
  ProviderType,
  TaskBindingType,
  ApiKeyStorageMode
} from '../../types';
import { createLLMProvider } from '../../providers/factory';
import { resetEntireDatabase } from '../../db';
import {
  saveSecretApiKey,
  getSecretApiKey,
  clearAllSecretApiKeys,
  isStrictLoopbackURL
} from '../../utils/secretStore';
import {
  X,
  Shield,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  Lock,
  Key,
  ShieldAlert,
  Sparkles,
  ChevronDown,
  RotateCcw
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
}

const PRESET_TEMPLATES: {
  title: string;
  desc: string;
  badge: string;
  profile: Omit<ModelProfile, 'id'>;
}[] = [
  {
    title: 'DeepSeek V3 / R1',
    desc: '高性价比严肃文学审读 (官方或第三方中转)',
    badge: 'deepseek',
    profile: {
      name: 'DeepSeek V3 / R1',
      providerType: 'deepseek',
      model: 'deepseek-chat',
      baseURL: 'https://api.deepseek.com/v1',
      temperature: 0.2,
      maxTokens: 3000,
      taskBinding: 'general',
    },
  },
  {
    title: 'Claude 3.7 Sonnet',
    desc: '高敏锐度冷读者盲审、对白潜台词与深层细读',
    badge: 'anthropic',
    profile: {
      name: 'Claude 3.7 Sonnet (Deep Critic)',
      providerType: 'anthropic',
      model: 'claude-3-7-sonnet-20250219',
      temperature: 0.3,
      maxTokens: 4000,
      taskBinding: 'general',
    },
  },
  {
    title: 'OpenAI GPT-4o',
    desc: 'GPT-4o / GPT-4o-mini 或自定义兼容接口',
    badge: 'openai',
    profile: {
      name: 'OpenAI GPT-4o',
      providerType: 'openai',
      model: 'gpt-4o',
      baseURL: 'https://api.openai.com/v1',
      temperature: 0.3,
      maxTokens: 3000,
      taskBinding: 'general',
    },
  },
  {
    title: 'Google Gemini 2.0 / 2.5',
    desc: '快速审校、长文本全书意象扫描与即时诊断',
    badge: 'gemini',
    profile: {
      name: 'Gemini 2.0 Flash',
      providerType: 'gemini',
      model: 'gemini-2.0-flash',
      temperature: 0.3,
      maxTokens: 3000,
      taskBinding: 'general',
    },
  },
  {
    title: 'Ollama 本地隐私模型',
    desc: '纯本地离线部署 (Qwen 2.5 / DeepSeek 本地版，无需 Key)',
    badge: 'ollama',
    profile: {
      name: 'Ollama 本地隐私 (Qwen 2.5 32B)',
      providerType: 'ollama',
      model: 'qwen2.5:32b',
      baseURL: 'http://localhost:11434',
      temperature: 0.2,
      maxTokens: 2048,
      taskBinding: 'local_privacy',
    },
  },
  {
    title: '自定义兼容接口',
    desc: 'SiliconFlow、OneAPI、NewAPI、OpenRouter 等转发端点',
    badge: 'custom',
    profile: {
      name: '自定义兼容模型',
      providerType: 'openai',
      model: 'custom-model',
      baseURL: 'https://api.openai.com/v1',
      temperature: 0.3,
      maxTokens: 3000,
      taskBinding: 'general',
    },
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [activeProfileId, setActiveProfileId] = useState(settings.activeProfileId);
  const [profiles, setProfiles] = useState<ModelProfile[]>(settings.profiles);
  const [localOnlyMode, setLocalOnlyMode] = useState(settings.localOnlyMode);
  const [keyStorageMode, setKeyStorageMode] = useState<ApiKeyStorageMode>(
    settings.keyStorageMode || 'session'
  );
  const [apiKeysMap, setApiKeysMap] = useState<Record<string, string>>({});
  const [masterPassphrase, setMasterPassphrase] = useState('');
  const [testResult, setTestResult] = useState<{ ok?: boolean; message?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveProfileId(settings.activeProfileId || settings.profiles[0]?.id || '');
      setProfiles(settings.profiles);
      setLocalOnlyMode(settings.localOnlyMode);
      setKeyStorageMode(settings.keyStorageMode || 'session');
      setTestResult(null);
      setShowPresetDropdown(false);
    }
  }, [isOpen, settings]);

  // Load API keys from secret store for each profile
  useEffect(() => {
    async function loadKeys() {
      const keys: Record<string, string> = {};
      for (const p of profiles) {
        const key = await getSecretApiKey(p.id, masterPassphrase || undefined);
        if (key) keys[p.id] = key;
        else if (p.apiKey) keys[p.id] = p.apiKey;
      }
      setApiKeysMap(keys);
    }
    if (isOpen) {
      loadKeys();
    }
  }, [isOpen, profiles, masterPassphrase]);

  if (!isOpen) return null;

  const currentProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0] || null;

  const handleUpdateCurrentProfile = (updates: Partial<ModelProfile>) => {
    if (!currentProfile) return;
    setProfiles((prev) =>
      prev.map((p) => (p.id === currentProfile.id ? { ...p, ...updates } : p))
    );
  };

  const handleApiKeyChange = (key: string) => {
    if (!currentProfile) return;
    setApiKeysMap((prev) => ({ ...prev, [currentProfile.id]: key }));
  };

  const handleTestConnection = async () => {
    if (!currentProfile) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const key = apiKeysMap[currentProfile.id] || currentProfile.apiKey;
      const provider = createLLMProvider(currentProfile, localOnlyMode, key);
      const res = await provider.testConnection();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || '连接失败' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearAllKeys = () => {
    if (confirm('确认清除当前设备/会话中存储的所有 API 密钥吗？清除后需重新输入。')) {
      clearAllSecretApiKeys();
      setApiKeysMap({});
      setMasterPassphrase('');
      alert('所有本地密钥已安全销毁。');
    }
  };

  const handleResetWorkspace = async () => {
    if (
      confirm(
        '⚠️ 危险操作：确认重置并初始化全部本地工作区数据吗？\n\n此操作将彻底清空本地所有项目、文稿、场景、批注记录与已存储的 API 密钥配置，使 Verso 恢复为完全纯净的初始状态。'
      )
    ) {
      clearAllSecretApiKeys();
      await resetEntireDatabase();
      window.location.reload();
    }
  };

  const handleSave = async () => {
    if (keyStorageMode === 'encrypted_local' && !masterPassphrase.trim()) {
      const hasAnyKeys = Object.values(apiKeysMap).some((k) => k && k.trim());
      if (hasAnyKeys) {
        alert('本地加密持久化必须提供主密码/口令以保护 API 密钥！');
        return;
      }
    }

    try {
      // Save keys into SecretStore according to chosen mode
      for (const [profileId, key] of Object.entries(apiKeysMap)) {
        await saveSecretApiKey(profileId, key, keyStorageMode, masterPassphrase || undefined);
      }

      // Sanitize profiles so apiKey isn't persisted in plain settings table
      const sanitizedProfiles = profiles.map((p) => {
        const copy = { ...p };
        delete copy.apiKey; // remove plaintext key from profile object
        return copy;
      });

      const finalActiveId = sanitizedProfiles.some((p) => p.id === activeProfileId)
        ? activeProfileId
        : (sanitizedProfiles[0]?.id || '');

      onSaveSettings({
        ...settings,
        activeProfileId: finalActiveId,
        profiles: sanitizedProfiles,
        keyStorageMode,
        localOnlyMode,
      });
      onClose();
    } catch (err: any) {
      alert(`保存密钥失败: ${err?.message || '未知错误'}`);
    }
  };

  const handleCreateFromTemplate = (template: Omit<ModelProfile, 'id'>) => {
    const newId = `prof-${Date.now()}`;
    const newProf: ModelProfile = {
      ...template,
      id: newId,
    };
    setProfiles((prev) => [...prev, newProf]);
    setActiveProfileId(newId);
    setShowPresetDropdown(false);
  };

  const handleAddNewBlankProfile = () => {
    const newId = `prof-${Date.now()}`;
    const newProf: ModelProfile = {
      id: newId,
      name: '新模型 Profile',
      providerType: 'openai',
      model: 'gpt-4o',
      baseURL: 'https://api.openai.com/v1',
      temperature: 0.3,
      maxTokens: 3000,
      taskBinding: 'general',
    };
    setProfiles((prev) => [...prev, newProf]);
    setActiveProfileId(newId);
    setShowPresetDropdown(false);
  };

  const handleDeleteProfile = (idToDelete: string) => {
    const next = profiles.filter((p) => p.id !== idToDelete);
    setProfiles(next);
    if (activeProfileId === idToDelete) {
      setActiveProfileId(next[0]?.id || '');
    }
  };

  const isCurrentEndpointLoopback = isStrictLoopbackURL(currentProfile?.baseURL);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-paper rounded-lg shadow-xl border border-line flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-cinnabar" />
            <h2 className="font-serif text-sm font-bold text-ink">
              BYOK 密钥安全与模型配置 (Model Profiles)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-ink-muted hover:text-ink rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 font-serif text-xs">
          {/* Privacy & Key Security Policy Banner */}
          <div className="p-3.5 bg-paper-sunken rounded border border-line space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 font-bold text-ink">
                <Lock className="w-3.5 h-3.5 text-ok" />
                <span>严肃文学创作者隐私与密钥防护策略</span>
              </div>
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localOnlyMode}
                  onChange={(e) => setLocalOnlyMode(e.target.checked)}
                  className="rounded border-[#D5CBB8] text-[#3D3934] focus:ring-0"
                />
                <span className="font-bold text-danger dark:text-[#EF9A9A]">
                  纯本地离线模式 (Local-only)
                </span>
              </label>
            </div>

            {/* Storage Mode Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-line">
              <label
                className={`p-2.5 rounded border cursor-pointer transition-all ${
                  keyStorageMode === 'session'
                    ? 'bg-paper-sunken border-cinnabar font-semibold'
                    : 'bg-paper border-line'
                }`}
              >
                <div className="flex items-center space-x-1.5 mb-1">
                  <input
                    type="radio"
                    name="keyStorageMode"
                    value="session"
                    checked={keyStorageMode === 'session'}
                    onChange={() => setKeyStorageMode('session')}
                    className="text-[#3D3934]"
                  />
                  <span className="font-bold">仅会话临时保存 (推荐: 最安全)</span>
                </div>
                <p className="text-[10px] text-ink-muted dark:text-[#A89F91] leading-tight">
                  密钥仅保留在当前会话内存中，关闭当前浏览器标签页后彻底销毁。
                </p>
              </label>

              <label
                className={`p-2.5 rounded border cursor-pointer transition-all ${
                  keyStorageMode === 'encrypted_local'
                    ? 'bg-paper-sunken border-cinnabar font-semibold'
                    : 'bg-paper border-line'
                }`}
              >
                <div className="flex items-center space-x-1.5 mb-1">
                  <input
                    type="radio"
                    name="keyStorageMode"
                    value="encrypted_local"
                    checked={keyStorageMode === 'encrypted_local'}
                    onChange={() => setKeyStorageMode('encrypted_local')}
                    className="text-[#3D3934]"
                  />
                  <span className="font-bold">本地主口令加密持久化</span>
                </div>
                <p className="text-[10px] text-ink-muted dark:text-[#A89F91] leading-tight">
                  使用 WebCrypto AES-GCM 256 位 + PBKDF2 强加密存储于本地沙箱。
                </p>
              </label>
            </div>

            {/* Master passphrase input when encrypted_local is selected */}
            {keyStorageMode === 'encrypted_local' && (
              <div className="p-2.5 bg-paper rounded border border-line-strong space-y-1.5">
                <label className="block text-[11px] font-bold text-cinnabar">
                  本地加密主口令 (Master Passphrase)
                </label>
                <input
                  type="password"
                  value={masterPassphrase}
                  onChange={(e) => setMasterPassphrase(e.target.value)}
                  placeholder="请输入用于派生 AES-256 密钥的主密码/口令……"
                  className="w-full p-2 bg-paper border border-line-strong rounded text-ink focus:outline-none font-mono text-xs"
                />
                <p className="text-[10px] text-ink-muted">
                  提示：Verso 严禁使用任何固定设备内置密码。请妥善保管此口令，下次打开软件解密时需再次输入。
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 border-t border-line">
              <span className="text-[10px] text-ink-muted leading-relaxed">
                Verso 为纯客户端无服务端架构，从不架设中央中转服务器。当您发起 AI 审读时，选中文稿与 API Key 将由浏览器直接发送给您所选择的模型服务商，绝不经过任何第三方未授权服务器。
              </span>
              <div className="flex items-center space-x-3 shrink-0">
                <button
                  onClick={handleClearAllKeys}
                  className="text-[11px] text-ink-muted hover:text-danger underline flex items-center space-x-1"
                >
                  <Key className="w-3 h-3" />
                  <span>清除全部密钥</span>
                </button>
                <button
                  onClick={handleResetWorkspace}
                  className="text-[11px] text-danger hover:text-danger font-bold underline flex items-center space-x-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>重置并初始化工作区</span>
                </button>
              </div>
            </div>
          </div>

          {/* Profile Selection list & Preset Quick Add */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-ink">
                选择活跃 Profile：
              </label>
              <div className="relative flex items-center space-x-2">
                <button
                  onClick={() => setShowPresetDropdown(!showPresetDropdown)}
                  className="flex items-center space-x-1 text-[11px] px-2 py-1 bg-paper hover:bg-paper-sunken border border-line rounded text-cinnabar hover:text-ink transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-cinnabar" />
                  <span>+ 添加服务商预设</span>
                  <ChevronDown className="w-3 h-3 ml-0.5" />
                </button>

                <button
                  onClick={handleAddNewBlankProfile}
                  className="flex items-center space-x-1 text-[11px] px-2 py-1 bg-paper hover:bg-paper-sunken border border-line rounded text-ink-muted hover:text-ink transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>新建空白</span>
                </button>

                {showPresetDropdown && (
                  <div className="absolute right-0 top-8 z-30 w-64 bg-paper rounded-lg shadow-xl border border-line-strong p-1.5 space-y-1 animate-in fade-in duration-100">
                    <div className="px-2 py-1 text-[10px] font-bold text-ink-muted border-b border-line">
                      选择预置服务商模板：
                    </div>
                    {PRESET_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.title}
                        onClick={() => handleCreateFromTemplate(tmpl.profile)}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-paper-sunken flex items-center justify-between group transition-colors"
                      >
                        <div>
                          <div className="text-xs font-bold text-ink group-hover:text-cinnabar">
                            {tmpl.title}
                          </div>
                          <div className="text-[10px] text-ink-muted truncate max-w-[170px]">
                            {tmpl.desc}
                          </div>
                        </div>
                        <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-paper-sunken text-ink-muted shrink-0">
                          {tmpl.badge}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* If no profiles configured yet, show onboarding card */}
            {profiles.length === 0 && (
              <div className="p-5 bg-paper-sunken rounded-lg border border-line space-y-3.5">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-cinnabar" />
                  <h3 className="font-bold text-ink text-xs">
                    未配置任何模型 Profile — 请选择您的 AI 服务商以快速添加：
                  </h3>
                </div>
                <p className="text-ink-muted text-[11px] leading-relaxed">
                  Verso 采用纯粹的 BYOK 机制，不设任何内置云端中转或 Mock 引擎。点击下方卡片即可一键创建配置并填入您的 API Key：
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {PRESET_TEMPLATES.map((tmpl) => (
                    <div
                      key={tmpl.title}
                      onClick={() => handleCreateFromTemplate(tmpl.profile)}
                      className="p-3 bg-paper hover:bg-paper-raise border border-line hover:border-cinnabar rounded cursor-pointer transition-all flex flex-col justify-between space-y-1.5 group shadow-xs"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-ink group-hover:text-cinnabar text-xs">
                            {tmpl.title}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-paper-sunken text-ink-muted">
                            {tmpl.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-ink-muted mt-1 leading-tight">
                          {tmpl.desc}
                        </p>
                      </div>
                      <div className="text-[11px] text-cinnabar font-medium flex items-center space-x-1 pt-1 border-t border-line/50">
                        <Plus className="w-3 h-3" />
                        <span>快速添加此模型</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profiles.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {profiles.map((p) => {
                  const isActive = p.id === activeProfileId;
                  const hasKey =
                    p.providerType === 'ollama' ||
                    Boolean(apiKeysMap[p.id] || p.apiKey);
                  return (
                    <div
                      key={p.id}
                      onClick={() => setActiveProfileId(p.id)}
                      className={`p-2.5 rounded border cursor-pointer transition-all ${
                        isActive
                          ? 'bg-paper-sunken border-cinnabar text-ink font-bold shadow-xs'
                          : 'bg-paper border-line text-ink-muted hover:bg-paper-sunken'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate text-xs">{p.name}</span>
                        {hasKey && <span className="w-1.5 h-1.5 rounded-full bg-ok" title="已配置 Key / 本地服务" />}
                      </div>
                      <div className="text-[10px] text-ink-muted dark:text-ink-muted truncate font-mono mt-0.5">
                        {p.providerType} • {p.taskBinding || 'general'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Profile Configuration Form */}
          {currentProfile && (
            <div className="p-4 rounded border border-line bg-paper space-y-3 animate-in fade-in duration-100">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <h3 className="font-bold text-ink">
                  Profile 详细配置: {currentProfile.name}
                </h3>
                <button
                  onClick={() => handleDeleteProfile(currentProfile.id)}
                  className="text-danger hover:text-danger text-[11px] flex items-center space-x-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>删除 Profile</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-ink-muted mb-1">
                    Profile 名称
                  </label>
                  <input
                    type="text"
                    value={currentProfile.name}
                    onChange={(e) => handleUpdateCurrentProfile({ name: e.target.value })}
                    className="w-full p-2 bg-paper border border-line-strong rounded text-ink focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-ink-muted mb-1">
                    Provider 架构类型
                  </label>
                  <select
                    value={currentProfile.providerType}
                    onChange={(e) =>
                      handleUpdateCurrentProfile({ providerType: e.target.value as ProviderType })
                    }
                    className="w-full p-2 bg-paper border border-line-strong rounded text-ink focus:outline-none"
                  >
                    <option value="deepseek">DeepSeek 官方 API</option>
                    <option value="anthropic">Anthropic (Claude 3.5 / 3.7)</option>
                    <option value="openai">OpenAI 官方兼容接口</option>
                    <option value="gemini">Google Gemini (Flash / Pro)</option>
                    <option value="ollama">Ollama (本地私有模型)</option>
                    <option value="openrouter">OpenRouter 路由</option>
                    <option value="custom">自定义网关 (Custom Gateway)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-ink-muted mb-1">
                    优先任务绑定 (Task Binding)
                  </label>
                  <select
                    value={currentProfile.taskBinding || 'general'}
                    onChange={(e) =>
                      handleUpdateCurrentProfile({ taskBinding: e.target.value as TaskBindingType })
                    }
                    className="w-full p-2 bg-paper border border-line-strong rounded text-ink focus:outline-none"
                  >
                    <option value="general">通用文学审读 (General)</option>
                    <option value="cold_reader">冷读者盲审 (Cold Reader)</option>
                    <option value="line_editor">逐字细修与删削 (Line Editor)</option>
                    <option value="quick_critique">快速审校 (Quick Critique)</option>
                    <option value="ask">文学讨论与发问 (Ask)</option>
                    <option value="local_privacy">本地隐私模式专享 (Local Privacy)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-ink-muted mb-1">
                    模型名称 (Model Identifier)
                  </label>
                  <input
                    type="text"
                    value={currentProfile.model}
                    onChange={(e) => handleUpdateCurrentProfile({ model: e.target.value })}
                    placeholder="e.g. deepseek-chat, claude-3-7-sonnet-20250219, gpt-4o, qwen2.5:32b"
                    className="w-full p-2 font-mono bg-paper border border-line-strong rounded text-ink focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-ink-muted mb-1">
                    API 基础地址 (Base URL)
                  </label>
                  <input
                    type="text"
                    value={currentProfile.baseURL || ''}
                    onChange={(e) => handleUpdateCurrentProfile({ baseURL: e.target.value })}
                    placeholder="e.g. https://api.deepseek.com/v1 或 http://localhost:11434"
                    className={`w-full p-2 font-mono bg-paper border rounded text-ink focus:outline-none ${
                      localOnlyMode && !isCurrentEndpointLoopback
                        ? 'border-danger'
                        : 'border-line-strong'
                    }`}
                  />
                  {localOnlyMode && !isCurrentEndpointLoopback && (
                    <p className="text-[10px] text-danger mt-1 flex items-center space-x-1">
                      <ShieldAlert className="w-3 h-3 shrink-0" />
                      <span>纯本地模式下仅允许回环地址 (localhost / 127.0.0.1)</span>
                    </p>
                  )}
                </div>
              </div>

              {currentProfile.providerType !== 'ollama' && (
                <div>
                  <label className="block text-[11px] font-bold text-ink-muted mb-1">
                    API Key (本地安全沙箱存储，不上传自有服务器)
                  </label>
                  <input
                    type="password"
                    value={apiKeysMap[currentProfile.id] || ''}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder="sk-..."
                    className="w-full p-2 font-mono bg-paper border border-line-strong rounded text-ink focus:outline-none"
                  />
                </div>
              )}

              {/* Sliders: Temperature & Max Tokens */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <div className="flex justify-between text-[11px] font-bold text-ink-muted mb-1">
                    <span>生成温度 (Temperature): {currentProfile.temperature}</span>
                    <span className="font-normal text-[10px] text-[#A89F91]">
                      严肃文学建议 0.2 ~ 0.3
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={currentProfile.temperature}
                    onChange={(e) =>
                      handleUpdateCurrentProfile({ temperature: parseFloat(e.target.value) })
                    }
                    className="w-full accent-cinnabar"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-bold text-ink-muted mb-1">
                    <span>最大 Token 限制: {currentProfile.maxTokens}</span>
                  </div>
                  <input
                    type="number"
                    value={currentProfile.maxTokens}
                    onChange={(e) =>
                      handleUpdateCurrentProfile({ maxTokens: parseInt(e.target.value, 10) })
                    }
                    className="w-full p-1.5 font-mono bg-paper border border-line-strong rounded text-ink focus:outline-none"
                  />
                </div>
              </div>

              {/* Connection Test */}
              <div className="pt-2 flex items-center justify-between border-t border-line">
                <button
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="px-3 py-1.5 bg-paper-sunken hover:bg-line text-ink rounded transition-colors text-xs font-medium"
                >
                  {isTesting ? '正在测试连通性……' : '测试此 Profile 连通性'}
                </button>

                {testResult && (
                  <div
                    className={`flex items-center space-x-1.5 text-xs ${
                      testResult.ok
                        ? 'text-ok dark:text-[#81C784]'
                        : 'text-danger dark:text-[#EF9A9A]'
                    }`}
                  >
                    {testResult.ok ? (
                      <CheckCircle className="w-3.5 h-3.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-line space-x-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs bg-cinnabar hover:bg-cinnabar-strong text-white font-medium rounded shadow-xs transition-colors"
          >
            保存并应用
          </button>
        </div>
      </div>
    </div>
  );
};
