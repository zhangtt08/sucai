import { useEffect, useState } from 'react';
import { selectDirectory } from '../services/ipc';
import type { AppSettings } from '../services/types';
import {
  AlertIcon,
  ExternalLinkIcon,
  FolderIcon,
  KeyIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  XIcon,
} from './Icons';

interface Props {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<void>;
  onClose: () => void;
  onPluginsReload: () => void;
}

const apiFields = [
  { key: 'unsplash', label: 'Unsplash', hint: 'Access Key', url: 'https://unsplash.com/developers' },
  { key: 'pexels', label: 'Pexels', hint: 'API Key', url: 'https://www.pexels.com/api/' },
  { key: 'pixabay', label: 'Pixabay', hint: 'API Key', url: 'https://pixabay.com/api/docs/' },
  { key: 'giphy', label: 'Giphy', hint: 'API Key', url: 'https://developers.giphy.com/' },
  { key: 'flickr', label: 'Flickr', hint: 'API Key', url: 'https://www.flickr.com/services/apps/create/' },
] as const;

export function SettingsDialog({ settings, onSave, onClose, onPluginsReload }: Props) {
  const [local, setLocal] = useState<AppSettings>({
    ...settings,
    apiKeys: { ...settings.apiKeys },
    enabledSources: [...settings.enabledSources],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, saving]);

  const chooseDirectory = async () => {
    const directory = await selectDirectory();
    if (directory) setLocal((current) => ({ ...current, downloadDir: directory }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(local);
      await onPluginsReload();
      onClose();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : '设置保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      aria-labelledby="settings-title"
      aria-modal="true"
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
      role="dialog"
    >
      <div className="modal-card">
        <div className="panel-header px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="section-icon"><SettingsIcon className="size-5" /></div>
            <div>
              <p className="eyebrow mb-0.5">偏好设置</p>
              <h2 className="text-base font-semibold text-ink dark:text-white" id="settings-title">设置</h2>
            </div>
          </div>
          <button aria-label="关闭设置" className="icon-button" disabled={saving} onClick={onClose} type="button">
            <XIcon className="size-[18px]" />
          </button>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-5">
          <section>
            <div className="section-heading">
              <KeyIcon className="size-4" />
              <div>
                <h3>素材平台</h3>
                <p>密钥仅保存在这台电脑上。大都会艺术馆、芝加哥艺术馆和 Wikimedia 免密钥，开箱即用。</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {apiFields.map(({ key, label, hint, url }) => (
                <div className="setting-field" key={key}>
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor={`api-${key}`}>
                      {label}
                      <span>{hint}</span>
                    </label>
                    <a className="external-link" href={url} rel="noreferrer" target="_blank">
                      获取密钥
                      <ExternalLinkIcon className="size-3" />
                    </a>
                  </div>
                  <input
                    autoComplete="off"
                    id={`api-${key}`}
                    onChange={(event) => setLocal((current) => ({
                      ...current,
                      apiKeys: { ...current.apiKeys, [key]: event.target.value },
                    }))}
                    placeholder={`粘贴 ${label} ${hint}`}
                    type="password"
                    value={local.apiKeys[key]}
                  />
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="section-heading">
              <FolderIcon className="size-4" />
              <div>
                <h3>下载位置</h3>
                <p>新任务会直接保存到这个文件夹。</p>
              </div>
            </div>
            <div className="directory-picker mt-4">
              <div className="min-w-0 flex-1">
                <p>默认文件夹</p>
                <span title={local.downloadDir}>{local.downloadDir || '每次下载时选择'}</span>
              </div>
              <button className="button-secondary button-small" onClick={chooseDirectory} type="button">
                浏览
              </button>
            </div>
          </section>

          <section>
            <div className="section-heading">
              <SunIcon className="size-4" />
              <div>
                <h3>外观</h3>
                <p>选择适合当前工作环境的界面主题。</p>
              </div>
            </div>
            <div className="theme-options mt-4">
              {([
                { value: 'light', label: '浅色', icon: SunIcon },
                { value: 'dark', label: '深色', icon: MoonIcon },
              ] as const).map(({ value, label, icon: ThemeIcon }) => (
                <button
                  aria-pressed={local.theme === value}
                  className="theme-option"
                  key={value}
                  onClick={() => setLocal((current) => ({ ...current, theme: value }))}
                  type="button"
                >
                  <ThemeIcon className="size-5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </section>

          {error && (
            <div className="inline-error" role="alert">
              <AlertIcon className="size-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="button-secondary" disabled={saving} onClick={onClose} type="button">取消</button>
          <button className="button-primary min-w-[102px] justify-center" disabled={saving} onClick={save} type="button">
            {saving && <span className="loading-ring loading-ring-light" />}
            {saving ? '保存中' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
}
