export interface CategoryEngagement {
  category: string;
  watchTime: number;        // Total seconds watched
  completionRate: number;   // Average completion percentage
  interactions: {
    likes: number;
    comments: number;
    shares: number;
  };
  lastInteracted: string;   // ISO timestamp
}

export interface UserProfile {
  userId: string;
  lastActive: string;       // ISO timestamp
  totalWatchTime: number;   // Total seconds across all videos
  categoryPreferences: {    // Mapped by category name
    [category: string]: CategoryEngagement;
  };
  activeHours: {           // 0-23 hour based activity count
    [hour: number]: number;
  };
  lastUpdated: string;     // ISO timestamp
} 