"use client";

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, CategoryEngagement } from '../types/userProfile';

export function useUserProfile(userId: string | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Aggregate user interactions into category preferences
  const aggregateInteractions = useCallback(async () => {
    if (!userId) return null;

    try {
      // Query all user interactions
      const interactionsRef = collection(db, "user_interactions");
      const userInteractionsQuery = query(
        interactionsRef,
        where("userId", "==", userId)
      );
      
      const querySnapshot = await getDocs(userInteractionsQuery);
      
      // Initialize aggregation objects
      const categoryPreferences: { [category: string]: CategoryEngagement } = {};
      const activeHours: { [hour: number]: number } = {};
      let totalWatchTime = 0;

      // Process each interaction
      querySnapshot.forEach((doc) => {
        const interaction = doc.data();
        const interactionDate = new Date(interaction.timestamp);
        const hour = interactionDate.getHours();

        // Update active hours
        activeHours[hour] = (activeHours[hour] || 0) + 1;

        // Get or initialize category engagement
        if (!categoryPreferences[interaction.category]) {
          categoryPreferences[interaction.category] = {
            category: interaction.category,
            watchTime: 0,
            completionRate: 0,
            interactions: { likes: 0, comments: 0, shares: 0 },
            lastInteracted: interaction.timestamp
          };
        }

        const categoryData = categoryPreferences[interaction.category];

        // Update watch time and completion rate
        const watchTimeSeconds = (interaction.watchPercentage / 100) * (300); // Assuming average video length of 5 minutes
        categoryData.watchTime += watchTimeSeconds;
        totalWatchTime += watchTimeSeconds;

        // Update completion rate as rolling average
        const oldCount = categoryData.completionRate > 0 ? 1 : 0;
        categoryData.completionRate = (
          (categoryData.completionRate * oldCount + interaction.watchPercentage) / 
          (oldCount + 1)
        );

        // Update interaction counts
        if (interaction.interactions) {
          if (interaction.interactions.liked) categoryData.interactions.likes++;
          if (interaction.interactions.commented) categoryData.interactions.comments++;
          if (interaction.interactions.shared) categoryData.interactions.shares++;
        }

        // Update last interaction time if more recent
        if (interaction.timestamp > categoryData.lastInteracted) {
          categoryData.lastInteracted = interaction.timestamp;
        }
      });

      // Update the user profile
      const updatedProfile: UserProfile = {
        userId,
        lastActive: new Date().toISOString(),
        totalWatchTime,
        categoryPreferences,
        activeHours,
        lastUpdated: new Date().toISOString()
      };

      // Save to Firestore
      const profileRef = doc(db, "user_profiles", userId);
      await setDoc(profileRef, updatedProfile);
      setProfile(updatedProfile);
      
      return updatedProfile;
    } catch (err) {
      setError('Failed to aggregate user interactions');
      return null;
    }
  }, [userId]);

  // Fetch or create user profile
  const loadUserProfile = useCallback(async () => {
    if (!userId) return null;
    
    setLoading(true);
    setError(null);

    try {
      // Try to fetch existing profile
      const profileRef = doc(db, "user_profiles", userId);
      const profileDoc = await getDoc(profileRef);

      if (profileDoc.exists()) {
        const profileData = profileDoc.data() as UserProfile;
        setProfile(profileData);
        return profileData;
      }

      // If no profile exists, create a new one and aggregate interactions
      const newProfile = await aggregateInteractions();
      if (!newProfile) {
        throw new Error('Failed to create initial profile');
      }
      
      return newProfile;
    } catch (err) {
      setError('Failed to load user profile');
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId, aggregateInteractions]);

  // Load profile on mount or userId change
  useEffect(() => {
    loadUserProfile();
  }, [userId, loadUserProfile]);

  return {
    profile,
    loading,
    error,
    refreshProfile: loadUserProfile,
    aggregateInteractions
  };
} 