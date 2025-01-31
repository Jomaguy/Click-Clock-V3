export interface UserInteraction {
  userId: string;
  videoId: string;
  timestamp: string;
  watchPercentage: number;
  category: string;
  interactions: {
    liked: boolean;
    commented: boolean;
    shared: boolean;
  }
}

// Helper type for updating specific interactions
export type InteractionType = 'liked' | 'commented' | 'shared'; 