"use client";

import { useCallback, useRef } from 'react';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserInteraction, InteractionType } from '../types/tracking';

export function useInteractionTracking(userId: string | null) {
  // Keep track of initialized videos to avoid redundant checks
  const initializedVideos = useRef<Set<string>>(new Set());

  // Helper function to generate interaction document ID
  const getInteractionId = (videoId: string) => {
    if (!userId) return null;
    return `${userId}_${videoId}`;
  };

  // Initialize or update interaction document
  const initializeInteraction = useCallback(async (videoId: string, category: string) => {
    if (!userId) return null;

    const interactionId = getInteractionId(videoId);
    if (!interactionId) return null;

    // Skip if already initialized
    if (initializedVideos.current.has(videoId)) {
      return;
    }

    try {
      // Check if interaction document already exists
      const docRef = doc(db, "user_interactions", interactionId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        // Create new interaction document
        const newInteraction: UserInteraction = {
          userId,
          videoId,
          timestamp: new Date().toISOString(),
          watchPercentage: 0,
          category,
          interactions: {
            liked: false,
            commented: false,
            shared: false
          }
        };

        await setDoc(docRef, newInteraction);
        console.log(`[Tracking] Initialized interaction for video ${videoId}`);
        initializedVideos.current.add(videoId);
        return newInteraction;
      }

      console.log(`[Tracking] Found existing interaction for video ${videoId}`);
      initializedVideos.current.add(videoId);
      return docSnap.data() as UserInteraction;
    } catch (error) {
      console.error("[Tracking] Error initializing interaction:", error);
      return null;
    }
  }, [userId]);

  // Update watch percentage
  const updateWatchPercentage = useCallback(async (videoId: string, percentage: number) => {
    if (!userId) return;

    const interactionId = getInteractionId(videoId);
    if (!interactionId) return;

    try {
      const roundedPercentage = Math.round(percentage);
      
      // Only update if it's a multiple of 5 to reduce writes
      if (roundedPercentage % 5 === 0) {
        const docRef = doc(db, "user_interactions", interactionId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          // If document doesn't exist, initialize it first
          await initializeInteraction(videoId, 'uncategorized'); // Default category if not known
        }

        await updateDoc(docRef, {
          userId,
          watchPercentage: roundedPercentage,
          lastUpdated: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("[Tracking] Error updating watch percentage:", error);
      initializedVideos.current.delete(videoId); // Remove from initialized set if there's an error
    }
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
        // If document doesn't exist, initialize it first
        await initializeInteraction(videoId, 'uncategorized'); // Default category if not known
      }
      
      await updateDoc(docRef, {
        userId,
        [`interactions.${interactionType}`]: value,
        lastUpdated: new Date().toISOString()
      });

      console.log(`[Tracking] Updated ${interactionType} for video ${videoId}: ${value}`);
    } catch (error) {
      console.error(`[Tracking] Error updating ${interactionType}:`, error);
      initializedVideos.current.delete(videoId); // Remove from initialized set if there's an error
    }
  }, [userId, initializeInteraction]);

  return {
    initializeInteraction,
    updateWatchPercentage,
    updateInteraction
  };
} 