"use client";

import { useCallback } from 'react';
import { VideoType } from '../types/types';
import { UserProfile } from '../types/userProfile';

// Scoring weights (total = 100)
const WEIGHTS = {
  CATEGORY_MATCH: 35,      // How well the video category matches user preferences
  COMPLETION_RATE: 25,     // How likely the user is to complete videos in this category
  INTERACTION_SCORE: 20,   // Based on likes, comments, shares in the category
  TIME_DECAY: 10,         // Newer videos get higher scores
  ENGAGEMENT_RATIO: 10    // Video's overall engagement from all users
};

interface VideoScore {
  video: VideoType;
  score: number;
  matchReasons: string[];
}

export function useVideoScoring() {
  // Calculate category match score based on user's watch history
  const calculateCategoryMatchScore = useCallback((
    video: VideoType,
    userProfile: UserProfile
  ): number => {
    const categoryData = userProfile.categoryPreferences[video.category];
    if (!categoryData) return 0;

    // Calculate watch time ratio for this category
    const totalWatchTime = Object.values(userProfile.categoryPreferences)
      .reduce((sum, cat) => sum + cat.watchTime, 0);
    const categoryWatchRatio = categoryData.watchTime / totalWatchTime;

    return categoryWatchRatio * 100; // Convert to percentage
  }, []);

  // Calculate completion likelihood based on category history
  const calculateCompletionScore = useCallback((
    video: VideoType,
    userProfile: UserProfile
  ): number => {
    const categoryData = userProfile.categoryPreferences[video.category];
    if (!categoryData) return 50; // Default to neutral score
    
    return categoryData.completionRate;
  }, []);

  // Calculate interaction score based on user's history with the category
  const calculateInteractionScore = useCallback((
    video: VideoType,
    userProfile: UserProfile
  ): number => {
    const categoryData = userProfile.categoryPreferences[video.category];
    if (!categoryData) return 0;

    const { likes, comments, shares } = categoryData.interactions;
    
    // Weight different types of interactions
    const interactionScore = (
      (likes * 1) +    // Base weight for likes
      (comments * 2) + // Comments show more engagement
      (shares * 3)     // Shares show highest engagement
    );

    // Normalize to 0-100
    const maxPossibleScore = 30; // Arbitrary cap for normalization
    return Math.min((interactionScore / maxPossibleScore) * 100, 100);
  }, []);

  // Calculate time decay score (newer = higher score)
  const calculateTimeDecayScore = useCallback((video: VideoType): number => {
    if (!video.timestamp) return 50; // Default score for videos without timestamp
    
    const now = new Date().getTime();
    const videoDate = new Date(video.timestamp).getTime();
    const age = now - videoDate;
    const dayInMs = 24 * 60 * 60 * 1000;
    const daysOld = age / dayInMs;

    // Videos older than 30 days start losing score
    if (daysOld <= 30) return 100;
    
    // Score decreases by 2 points per day after 30 days
    const decay = Math.max(0, 100 - ((daysOld - 30) * 2));
    return decay;
  }, []);

  // Calculate engagement ratio from all users
  const calculateEngagementScore = useCallback((video: VideoType): number => {
    const totalEngagements = (
      (video.likes?.length || 0) +
      (video.comments?.length || 0)
    );

    // Normalize to 0-100 (assuming 50 engagements is a highly engaged video)
    return Math.min((totalEngagements / 50) * 100, 100);
  }, []);

  // Main scoring function
  const scoreVideo = useCallback((
    video: VideoType,
    userProfile: UserProfile
  ): VideoScore => {
    const categoryMatchScore = calculateCategoryMatchScore(video, userProfile);
    const completionScore = calculateCompletionScore(video, userProfile);
    const interactionScore = calculateInteractionScore(video, userProfile);
    const timeDecayScore = calculateTimeDecayScore(video);
    const engagementScore = calculateEngagementScore(video);

    // Calculate weighted average
    const totalScore = (
      (categoryMatchScore * WEIGHTS.CATEGORY_MATCH) +
      (completionScore * WEIGHTS.COMPLETION_RATE) +
      (interactionScore * WEIGHTS.INTERACTION_SCORE) +
      (timeDecayScore * WEIGHTS.TIME_DECAY) +
      (engagementScore * WEIGHTS.ENGAGEMENT_RATIO)
    ) / 100; // Divide by 100 since weights total to 100

    // Generate explanation for why this video was scored highly
    const matchReasons: string[] = [];
    if (categoryMatchScore > 70) {
      matchReasons.push("Based on your watching history");
    }
    if (completionScore > 70) {
      matchReasons.push("You often watch videos like this");
    }
    if (interactionScore > 70) {
      matchReasons.push("Similar to videos you've engaged with");
    }
    if (timeDecayScore > 90) {
      matchReasons.push("Recently uploaded");
    }
    if (engagementScore > 70) {
      matchReasons.push("Popular with other users");
    }

    return {
      video,
      score: totalScore,
      matchReasons
    };
  }, [
    calculateCategoryMatchScore,
    calculateCompletionScore,
    calculateInteractionScore,
    calculateTimeDecayScore,
    calculateEngagementScore
  ]);

  // Score multiple videos and sort by score
  const scoreVideos = useCallback((
    videos: VideoType[],
    userProfile: UserProfile
  ): VideoScore[] => {
    return videos
      .map(video => scoreVideo(video, userProfile))
      .sort((a, b) => b.score - a.score);
  }, [scoreVideo]);

  return {
    scoreVideo,
    scoreVideos
  };
} 