"use client";

import { useCallback } from 'react';
import { VideoType } from '../types/types';
import { UserProfile } from '../types/userProfile';
import { useVideoScoring } from './useVideoScoring';

/**
 * A hook that provides personalized video recommendations based on user preferences
 */
export function useForYouVideos(videos: VideoType[], userProfile: UserProfile) {
  const { scoreVideos } = useVideoScoring();

  const getPersonalizedVideos = useCallback((limit: number = 10, offset: number = 0) => {
    // Score all available videos
    const allScoredVideos = scoreVideos(videos, userProfile);
    
    // Sort by score in descending order
    const sortedVideos = allScoredVideos.sort((a, b) => b.score - a.score);
    
    // Return the requested slice
    return sortedVideos.slice(offset, offset + limit);
  }, [videos, userProfile, scoreVideos]);

  return {
    getPersonalizedVideos
  };
} 