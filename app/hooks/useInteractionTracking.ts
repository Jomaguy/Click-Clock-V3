"use client";

import { useCallback, useRef, useEffect } from 'react';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserInteraction, InteractionType } from '../types/tracking';

export function useInteractionTracking(userId: string | null) {
  // Keep track of initialized videos to avoid redundant checks
  const initializedVideos = useRef<Set<string>>(new Set());
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup function
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      initializedVideos.current.clear();
    };
  }, []);

  // Helper function to generate interaction document ID
  const getInteractionId = (videoId: string) => {
    if (!userId) return null;
    return `${userId}_${videoId}`;
  };

  // Initialize or update interaction document
  const initializeInteraction = useCallback(async (videoId: string, category: string) => {
    if (!userId || !videoId) return null;

    const interactionId = getInteractionId(videoId);
    if (!interactionId) return null;

    try {
      // Check if already initialized to prevent redundant calls
      if (initializedVideos.current.has(videoId)) {
        return null;
      }

      const videoDoc = await getDoc(doc(db, "videos", videoId));
      if (!videoDoc.exists()) {
        return null;
      }

      const videoData = videoDoc.data();
      const videoCategory = videoData.category;
      
      if (!videoCategory) {
        return null;
      }

      const docRef = doc(db, "user_interactions", interactionId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        const newInteraction: UserInteraction = {
          userId,
          videoId,
          timestamp: new Date().toISOString(),
          watchPercentage: 0,
          category: videoCategory,
          interactions: {
            liked: false,
            commented: false,
            shared: false
          }
        };

        await setDoc(docRef, newInteraction);
        initializedVideos.current.add(videoId);
        return newInteraction;
      }

      const existingData = docSnap.data() as UserInteraction;
      if (existingData.category !== videoCategory) {
        await updateDoc(docRef, { 
          category: videoCategory,
          lastUpdated: new Date().toISOString()
        });
      }

      initializedVideos.current.add(videoId);
      return existingData;
    } catch (error) {
      return null;
    }
  }, [userId]);

  // Update watch percentage with debouncing
  const updateWatchPercentage = useCallback(async (videoId: string, percentage: number) => {
    if (!userId) return;

    const interactionId = getInteractionId(videoId);
    if (!interactionId) return;

    // Clear any existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Set a new timeout to debounce the update
    updateTimeoutRef.current = setTimeout(async () => {
      try {
        const roundedPercentage = Math.round(percentage);
        
        if (roundedPercentage % 5 === 0) {
          const docRef = doc(db, "user_interactions", interactionId);
          const docSnap = await getDoc(docRef);

          if (!docSnap.exists()) {
            const videoDoc = await getDoc(doc(db, "videos", videoId));
            if (!videoDoc.exists()) {
              return;
            }
            await initializeInteraction(videoId, videoDoc.data().category);
          }

          await updateDoc(docRef, {
            watchPercentage: roundedPercentage,
            lastUpdated: new Date().toISOString()
          });
        }
      } catch (error) {
        initializedVideos.current.delete(videoId);
      }
    }, 500); // 500ms debounce
  }, [userId, initializeInteraction]);

  // Update user interactions (likes, comments, shares)
  const updateInteraction = useCallback(async (
    videoId: string, 
    interactionType: InteractionType,
    value: boolean
  ) => {
    if (!userId) return;

    const interactionId = getInteractionId(videoId);
    if (!interactionId) return;

    try {
      const docRef = doc(db, "user_interactions", interactionId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        const videoDoc = await getDoc(doc(db, "videos", videoId));
        if (!videoDoc.exists()) {
          return;
        }
        await initializeInteraction(videoId, videoDoc.data().category);
      }
      
      await updateDoc(docRef, {
        [`interactions.${interactionType}`]: value,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      initializedVideos.current.delete(videoId);
    }
  }, [userId, initializeInteraction]);

  return {
    initializeInteraction,
    updateWatchPercentage,
    updateInteraction
  };
} 