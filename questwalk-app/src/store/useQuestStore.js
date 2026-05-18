import { create } from 'zustand';

const useQuestStore = create((set) => ({
  user: null,
  totalSteps: 0,
  currentStepCount: 0,
  coinBalance: 0,
  avatarUrl: null,
  cachedQuests: [],
  cachedClaimedQuestIds: new Set(),
  setUser: (user) => set({ 
    user,
    totalSteps: 0,
    currentStepCount: 0,
    coinBalance: 0,
    avatarUrl: null,
    cachedQuests: [],
    cachedClaimedQuestIds: new Set()
  }),
  setTotalSteps: (steps) => set({ totalSteps: steps }),
  setCurrentStepCount: (steps) => set({ currentStepCount: steps }),
  addSteps: (steps) => set((state) => ({ currentStepCount: state.currentStepCount + steps })),
  setCoinBalance: (balance) => set({ coinBalance: balance }),
  setAvatarUrl: (url) => set({ avatarUrl: url }),
  setCachedQuests: (quests) => set({ cachedQuests: quests }),
  setCachedClaimedQuestIds: (ids) => set({ cachedClaimedQuestIds: ids }),
}));

export default useQuestStore;
