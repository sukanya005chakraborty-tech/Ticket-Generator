import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useProjectStore = create(
  persist(
    (set) => ({
      selectedProjectId: null,
      selectedProject: null,   // full project object (name, key, role, etc.)

      setSelectedProject: (project) =>
        set({
          selectedProjectId: project?._id || project?.id || null,
          selectedProject: project || null,
        }),

      clearProject: () =>
        set({ selectedProjectId: null, selectedProject: null }),
    }),
    {
      name: 'project-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedProjectId: state.selectedProjectId,
        selectedProject:   state.selectedProject,
      }),
    }
  )
);
