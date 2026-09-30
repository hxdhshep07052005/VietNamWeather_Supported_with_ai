/**
 * Global Require Login Modal State
 * Enables any page or component to prompt unauthenticated users to log in
 */

import { create } from "zustand";

interface RequireLoginModalState {
  isOpen: boolean;
  featureName?: string;
  description?: string;
  openModal: (featureName?: string, description?: string) => void;
  closeModal: () => void;
}

export const useRequireLoginModal = create<RequireLoginModalState>((set) => ({
  isOpen: false,
  featureName: undefined,
  description: undefined,
  openModal: (featureName, description) =>
    set({ isOpen: true, featureName, description }),
  closeModal: () =>
    set({ isOpen: false, featureName: undefined, description: undefined }),
}));
