"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, CategoryEngagement } from '../types/userProfile';

const UPDATE_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds

export function useUserProfile(userId: string | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Aggregate interactions into user profile
  const aggregateInteractions = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      
      // Get all user interactions
      const interactionsRef = collection(db, "user_interactions");
      const q = query(interactionsRef, where("userId", "==", userId));
      const querySnapshot = await getDocs(q);

      // Initialize aggregated data
      const categoryPreferences: { [key: string]: CategoryEngagement } = {};
      const activeHours: { [key: number]: number } = {};
      let totalWatchTime = 0;

      // Process each interaction
      querySnapshot.forEach((doc) => {
        const interaction = doc.data();
        const category = interaction.category;
        const watchTime = interaction.watchPercentage * 60; // Convert percentage to seconds
        const interactionDate = new Date(interaction.lastUpdated || interaction.timestamp);
        const hour = interactionDate.getHours();

        // Update category preferences
        if (!categoryPreferences[category]) {
          categoryPreferences[category] = {
            category,
            watchTime: 0,
            completionRate: 0,
            interactions: { likes: 0, comments: 0, shares: 0 },
            lastInteracted: interaction.timestamp
          };
        }

        categoryPreferences[category].watchTime += watchTime;
        categoryPreferences[category].completionRate = 
          (categoryPreferences[category].completionRate + interaction.watchPercentage) / 2;
        
        if (interaction.interactions) {
          if (interaction.interactions.liked) categoryPreferences[category].interactions.likes++;
          if (interaction.interactions.commented) categoryPreferences[category].interactions.comments++;
          if (interaction.interactions.shared) categoryPreferences[category].interactions.shares++;
        }

        if (new Date(interaction.lastUpdated || interaction.timestamp) > 
            new Date(categoryPreferences[category].lastInteracted)) {
          categoryPreferences[category].lastInteracted = interaction.lastUpdated || interaction.timestamp;
        }

        // Update active hours
        activeHours[hour] = (activeHours[hour] || 0) + 1;

        // Update total watch time
        totalWatchTime += watchTime;
      });

      // Create or update user profile
      const profileRef = doc(db, "user_profiles", userId);
      const newProfile: UserProfile = {
        userId,
        totalWatchTime,
        categoryPreferences,
        activeHours,
        lastActive: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      await setDoc(profileRef, newProfile, { merge: true });
      setProfile(newProfile);
      lastUpdateRef.current = Date.now();
      
    } catch (error) {
      console.error("Error aggregating interactions:", error);
      setError("Failed to update profile");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Function to check if update is needed
  const checkAndUpdate = useCallback(async () => {
    const now = Date.now();
    if (now - lastUpdateRef.current >= UPDATE_INTERVAL) {
      await aggregateInteractions();
    }
  }, [aggregateInteractions]);

  // Initial profile load
  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const profileRef = doc(db, "user_profiles", userId);
      const profileSnap = await getDoc(profileRef);

      if (profileSnap.exists()) {
        const profileData = profileSnap.data() as UserProfile;
        setProfile(profileData);
        lastUpdateRef.current = Date.now();
      } else {
        await aggregateInteractions();
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [userId, aggregateInteractions]);

  // Set up periodic updates
  useEffect(() => {
    loadProfile();

    // Set up interval for periodic updates
    const intervalId = setInterval(checkAndUpdate, UPDATE_INTERVAL);

    // Cleanup
    return () => {
      clearInterval(intervalId);
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [userId, loadProfile, checkAndUpdate]);

  // Manual refresh function
  const refreshProfile = useCallback(async () => {
    await aggregateInteractions();
  }, [aggregateInteractions]);

  return {
    profile,
    loading,
    error,
    refreshProfile,
    aggregateInteractions
  };
} 