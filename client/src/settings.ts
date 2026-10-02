import { useCallback, useState } from 'react';

export interface Settings {
  turbo: boolean;
  reduceMotion: boolean;
}

const KEY = 'slot-party.settings';

function load(): Settings {
  const defaults: Settings = {
    turbo: false,
    reduceMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return defaults;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(load);
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);
  return [settings, update] as const;
}
