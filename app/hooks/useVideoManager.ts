"use client";

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, getDoc, updateDoc, arrayUnion, arrayRemove, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { VideoType, User } from '../types/types';
import { useForYouVideos } from './useForYouVideos';
import { useUserProfile } from './useUserProfile';
import { UserProfile } from '../types/userProfile';

interface VideoWithScore extends VideoType {
  score?: number;
  matchReasons?: string[];
}

export function useVideoManager(user: User | null) {
  const [videos, setVideos] = useState<VideoWithScore[]>([]);
  const [currentVideo, setCurrentVideo] = useState<VideoWithScore | null>(null);
  const [isPlaying, setIsPlaying] = useState<{ [key: number]: boolean }>({});
  const { profile: userProfile } = useUserProfile(user?.uid || null);
  const { getPersonalizedVideos } = useForYouVideos(videos, userProfile as UserProfile);

  // Function to fetch all videos from Firestore
  const fetchVideos = async () => {
    try {
      const videosCollectionRef = collection(db, "videos");
      const querySnapshot = await getDocs(videosCollectionRef);
  
      const allVideos = querySnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        return {
          id: doc.id,
          url: data.url,
          name: data.name || "Unnamed Video",
          uploaderName: data.uploaderName,
          uploaderId: data.uploaderId,
          comments: data.comments || [],
          likes: data.likes || [],
          category: data.category || "Uncategorized",
        } as VideoType;
      });
      return allVideos;
    } catch (error) {
      console.error("Error fetching videos:", error);
      return [];
    }
  };

  // Function to load more videos with personalization
  const loadMoreVideos = async () => {
    try {
      const allVideos = await fetchVideos();
      
      if (!user || !userProfile) {
        setVideos((prev: VideoWithScore[]) => {
          const existingIds = new Set(prev.map(video => video.id));
          const newVideos = allVideos
            .filter(video => !existingIds.has(video.id))
            .slice(0, 50);
          return [...prev, ...newVideos];
        });
      } else {
        // For personalized videos
        setVideos((prev: VideoWithScore[]) => {
          // Get IDs of videos we already have
          const existingIds = new Set(prev.map(video => video.id));
          
          // Filter out videos we already have
          const availableVideos = allVideos.filter(video => !existingIds.has(video.id));
          
          if (availableVideos.length === 0) {
            return prev; // No new videos to add
          }

          // Score the new batch of videos
          const scoredVideos = getPersonalizedVideos(50, prev.length);
          
          // Map the scored videos to include score and reasons
          const newPersonalizedVideos = scoredVideos.map(scored => ({
            ...scored.video,
            score: scored.score,
            matchReasons: scored.matchReasons
          }));

          return [...prev, ...newPersonalizedVideos];
        });
      }
    } catch (error) {
      console.error("Error loading more videos:", error);
    }
  };

  // Load initial videos with personalization
  useEffect(() => {
    const loadInitialVideos = async () => {
      try {
        const allVideos = await fetchVideos();
        if (user && userProfile) {
          const scoredVideos = getPersonalizedVideos(50, 0);
          const personalizedVideos = scoredVideos.map(scored => ({
            ...scored.video,
            score: scored.score,
            matchReasons: scored.matchReasons
          }));
          setVideos(personalizedVideos);
        } else {
          setVideos(allVideos.slice(0, 50)); // Load first 50 videos for non-authenticated users
        }
      } catch (error) {
        console.error("Error loading videos:", error);
      }
    };

    loadInitialVideos();
  }, [user, userProfile, getPersonalizedVideos]);

  // Function to update video in videos array
  const updateVideoInList = (videoId: string, updateFn: (video: VideoWithScore) => VideoWithScore) => {
    setVideos((prevVideos: VideoWithScore[]) => 
      prevVideos.map((video: VideoWithScore) => 
        video.id === videoId ? updateFn(video) : video
      )
    );

    if (currentVideo?.id === videoId) {
      setCurrentVideo((prev: VideoWithScore | null) => prev ? updateFn(prev) : null);
    }
  };

  // Function to update video likes
  const updateVideoLikes = async (videoId: string, userId: string, username: string, isAdding: boolean) => {
    const videoDocRef = doc(db, "videos", videoId);
    const timestamp = new Date().toISOString();
    const likeData = { username, timestamp };

    try {
      if (isAdding) {
        await updateDoc(videoDocRef, {
          likes: arrayUnion(likeData)
        });
      } else {
        // For removing, we need to find the exact like to remove
        const videoDoc = await getDoc(videoDocRef);
        if (videoDoc.exists()) {
          const currentLikes = videoDoc.data().likes || [];
          const likeToRemove = currentLikes.find((like: { username: string }) => like.username === username);
          if (likeToRemove) {
            await updateDoc(videoDocRef, {
              likes: arrayRemove(likeToRemove)
            });
          }
        }
      }

      updateVideoInList(videoId, video => ({
        ...video,
        likes: isAdding 
          ? [...video.likes, likeData]
          : video.likes.filter(like => like.username !== username)
      }));
    } catch (error) {
      console.error("Error updating video likes:", error);
      throw error;
    }
  };

  // Function to update video comments
  const updateVideoComments = async (videoId: string, username: string, text: string) => {
    const videoDocRef = doc(db, "videos", videoId);
    const timestamp = new Date().toISOString();
    const commentData = { username, text, timestamp };

    try {
      await updateDoc(videoDocRef, {
        comments: arrayUnion(commentData)
      });

      updateVideoInList(videoId, video => ({
        ...video,
        comments: [...video.comments, commentData]
      }));
    } catch (error) {
      console.error("Error updating video comments:", error);
      throw error;
    }
  };

  return {
    videos,
    currentVideo,
    isPlaying,
    setCurrentVideo,
    setIsPlaying,
    loadMoreVideos,
    updateVideoLikes,
    updateVideoComments,
    fetchVideos,
  };
} 