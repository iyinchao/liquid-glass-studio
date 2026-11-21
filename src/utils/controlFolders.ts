import { useLayoutEffect, useRef } from 'react';
import type languages from './languages';

const STORAGE_KEY = 'liquid-glass-studio:control-folders:v2';
const LEGACY_STORAGE_KEY = 'liquid-glass-studio:control-folders:v1';
const DEFAULT_COLLAPSED = {
  shapeSettings: false,
  materialSettings: false,
  lightingSettings: true,
  reflectionSettings: true,
  darkEdgeSettings: true,
  shadowSettings: true,
  backgroundSettings: false,
  basicSettings: true,
  debugSettings: true,
};

type FolderId = keyof typeof DEFAULT_COLLAPSED;
type FolderState = Record<FolderId, boolean>;
type Language = (typeof languages)[keyof typeof languages];

export function readControlFolderState(): FolderState {
  const state = { ...DEFAULT_COLLAPSED };
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    const saved = JSON.parse(current ?? localStorage.getItem(LEGACY_STORAGE_KEY) ?? '{}');
    for (const key of Object.keys(state) as FolderId[]) {
      if (typeof saved?.[key] === 'boolean') state[key] = saved[key];
    }
    // Apply the new background default once while keeping other saved folders.
    if (current === null) state.backgroundSettings = false;
  } catch {
    // Browsers that block storage can still use all controls.
  }
  return state;
}

export function useControlFolders(lang: Language, initialState: FolderState) {
  const collapsedState = useRef(initialState);

  useLayoutEffect(() => {
    const panel = document.querySelector<HTMLDivElement>('#root > [class^="leva-"]');
    if (!panel) return;
    const bindings = new Map<HTMLDivElement, () => void>();

    const connectFolders = () => {
      for (const [title, dispose] of bindings) {
        if (!panel.contains(title)) {
          dispose();
          bindings.delete(title);
        }
      }
      // Leva 0.10 keeps folder expansion inside its components. This bridge also
      // preserves stable, language-independent control paths for presets.
      for (const label of panel.querySelectorAll<HTMLDivElement>('svg + div')) {
        const key = label.textContent as FolderId;
        if (!Object.prototype.hasOwnProperty.call(DEFAULT_COLLAPSED, key)) continue;
        const title = label.parentElement as HTMLDivElement;
        const folder = title.parentElement;
        const content = title.nextElementSibling as HTMLDivElement | null;
        if (!folder || !content || bindings.has(title)) continue;
        const name = lang[`editor.${key}`];
        folder.dataset.levaFolder = '1';
        folder.dataset.folderId = key;
        folder.style.setProperty('--i18n-name', JSON.stringify(name));
        title.setAttribute('role', 'button');
        title.setAttribute('tabindex', '0');
        title.setAttribute('aria-label', name);

        const applyState = (collapsed: boolean) => {
          title.setAttribute('aria-expanded', String(!collapsed));
          content.inert = collapsed;
          content.setAttribute('aria-hidden', String(collapsed));
        };
        // The arrow reflects React state before the height animation runs.
        const arrow = label.previousElementSibling as SVGElement | null;
        const actualCollapsed = arrow?.style.transform === 'rotate(-90deg)';
        if (actualCollapsed !== collapsedState.current[key]) title.click();
        applyState(collapsedState.current[key]);

        const onClick = () => {
          const collapsed = title.getAttribute('aria-expanded') === 'true';
          collapsedState.current = { ...collapsedState.current, [key]: collapsed };
          applyState(collapsed);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsedState.current));
          } catch {
            // Expansion remains usable without persistence.
          }
        };
        const onKeyDown = (event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            title.click();
          }
        };
        title.addEventListener('click', onClick);
        title.addEventListener('keydown', onKeyDown);
        bindings.set(title, () => {
          title.removeEventListener('click', onClick);
          title.removeEventListener('keydown', onKeyDown);
        });
      }
    };

    // Folder nodes can mount after the panel or remount during search/filtering.
    const observer = new MutationObserver(connectFolders);
    observer.observe(panel, { childList: true, subtree: true });
    connectFolders();
    return () => {
      observer.disconnect();
      bindings.forEach(dispose => dispose());
    };
  }, [lang]);
}
