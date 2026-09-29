import { useState, useEffect, useCallback } from 'react';
import type { AppSettings } from '../services/types';
import { getSettings, saveSettings } from '../services/ipc';

const defaults: AppSettings = {
  apiKeys: { unsplash: '', pexels: '', pixabay: '', giphy: '', flickr: '' },
  downloadDir: '', enabledSources: [], theme: 'light',
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaults);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    getSettings()
      .then((savedSettings) => setSettings(savedSettings))
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : '设置读取失败'))
      .finally(() => setLoaded(true));
  }, []);

  const updateAndSave = useCallback(async (s: AppSettings) => {
    await saveSettings(s);
    setSettings(s);
  }, []);

  return { settings, loaded, loadError, updateAndSave };
}
