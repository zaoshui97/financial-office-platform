import { create } from 'zustand';

interface AppState {
  collapsed: boolean;
  language: string;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  setLanguage: (language: string) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  collapsed: false,
  language: 'zh-CN',
  setCollapsed: (collapsed) => set({ collapsed }),
  toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
  setLanguage: (language) => set({ language }),
}));
