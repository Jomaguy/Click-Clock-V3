// Interface representing a user's interaction with a video
// Captures details about the interaction and engagement level

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

// Unique identifier for the user
// Unique identifier for the video
// Timestamp of when the interaction occurred
// Percentage of the video watched by the user
// Category or genre of the video
// Object containing boolean flags for different types of interactions

// Helper type for specifying which interaction to update
// Can be 'liked', 'commented', or 'shared'

// Helper type for updating specific interactions
export type InteractionType = 'liked' | 'commented' | 'shared'; 