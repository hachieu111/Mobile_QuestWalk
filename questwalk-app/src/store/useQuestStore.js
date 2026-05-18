import { create } from 'zustand';

const useQuestStore = create((set) => ({
  user: null,
  totalSteps: 0,
  coinBalance: 0,
  avatarUrl: null,
  setUser: (user) => set({ 
    user,
    totalSteps: 0,
    coinBalance: 0,
    avatarUrl: null
  }),
  setTotalSteps: (steps) => set({ totalSteps: steps }),
  setCoinBalance: (balance) => set({ coinBalance: balance }),
  setAvatarUrl: (url) => set({ avatarUrl: url }),
}));

export default useQuestStore;
