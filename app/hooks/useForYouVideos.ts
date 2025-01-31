"use client";

import { useCallback } from 'react';
import { VideoType } from '../types/types';
import { UserProfile } from '../types/userProfile';
import { useVideoScoring } from './useVideoScoring';

/**
 * A simple hook that provides personalized video recommendations based on user preferences
 */
export function useForYouVideos(videos: VideoType[], userProfile: UserProfile) {
  const { scoreVideos } = useVideoScoring();

  const getPersonalizedVideos = useCallback((limit: number = 10) => {
    return scoreVideos(videos, userProfile).slice(0, limit);
  }, [videos, userProfile, scoreVideos]);

  return {
    getPersonalizedVideos
  };
} 