import { create } from 'zustand';

export const useUiStore = create((set) => ({
  sidebarCollapsed: false,
  activeModal: null,
  modalData: null,

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) =>
    set({ sidebarCollapsed: collapsed }),

  openModal: (name, data = null) =>
    set({ activeModal: name, modalData: data }),

  closeModal: () =>
    set({ activeModal: null, modalData: null }),
}));
