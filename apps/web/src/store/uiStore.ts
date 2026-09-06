import { create } from 'zustand';

export type Screen = 'monitor' | 'replay' | 'catalogue' | 'alerts' | 'detail' | 'methodology';

interface UIState {
  activeScreen: Screen;
  selectedFlareId: string | null;
  sidebarCollapsed: boolean;

  setScreen: (screen: Screen) => void;
  setSelectedFlare: (id: string | null) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeScreen: 'monitor',
  selectedFlareId: null,
  sidebarCollapsed: false,

  setScreen: (screen) => set({ activeScreen: screen }),
  setSelectedFlare: (id) => set({ selectedFlareId: id }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
