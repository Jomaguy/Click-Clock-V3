"use client";

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { VideoType, User } from '../types/types';

export function useVideoManager(user: User | null) {
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [currentVideo, setCurrentVideo] = useState<VideoType | null>(null);
  const [isPlaying, setIsPlaying] = useState<{ [key: number]: boolean }>({});

  // Function to fetch all videos from Firestore
  const fetchVideos = async () => {
    try {
      const videosCollectionRef = collection(db, "videos");
      const querySnapshot = await getDocs(videosCollectionRef);
  
      const allVideos = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          url: data.url,
          name: data.name || "Unnamed Video",
          uploaderName: data.uploaderName,
          uploaderId: data.uploaderId,
          comments: data.comments || [],
          likes: data.likes || [],
          dislikes: data.dislikes || [],
          category: data.category || "Uncategorized",
        };
      });
      return allVideos;
    } catch (error) {
      console.error("Error fetching videos:", error);
      return [];
    }
  };

  // Function to fetch user preferences
  const fetchUserPreferences = async (userId: string) => {
    try {
      const userDocRef = doc(db, "users", userId);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData.interests || [];
      } else {
        console.error("User document does not exist");
        return [];
      }
    } catch (error) {
      console.error("Error fetching user preferences:", error);
      return [];
    }
  };

  // Function to recommend videos based on user preferences
  const recommendVideos = async (userId: string) => {
    try {
      const userPreferences = await fetchUserPreferences(userId);
      const videosCollectionRef = collection(db, "videos");

      let preferredVideos: VideoType[] = [];
      let nonPreferredVideos: VideoType[] = [];

      if (userPreferences.length > 0) {
        const preferredVideosSnapshot = await getDocs(
          query(videosCollectionRef, where("category", "in", userPreferences))
        );

        preferredVideos = preferredVideosSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            url: data.url,
            name: data.name || "Unnamed Video",
            uploaderName: data.uploaderName,
            uploaderId: data.uploaderId,
            comments: data.comments || [],
            likes: data.likes || [],
            dislikes: data.dislikes || [],
            category: data.category,
          };
        });
      }

      const allVideosSnapshot = await getDocs(videosCollectionRef);
      nonPreferredVideos = allVideosSnapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            url: data.url,
            name: data.name || "Unnamed Video",
            uploaderName: data.uploaderName,
            uploaderId: data.uploaderId,
            comments: data.comments || [],
            likes: data.likes || [],
            dislikes: data.dislikes || [],
            category: data.category,
          };
        })
        .filter((video) => !userPreferences.includes(video.category));

      const allRecommendedVideos = [...preferredVideos, ...nonPreferredVideos];
      const sortedVideos = allRecommendedVideos.sort(
        (a, b) => b.likes.length - a.likes.length
      );

      return sortedVideos.slice(0, 100);
    } catch (error) {
      console.error("Error recommending videos:", error);
      return [];
    }
  };

  // Function to load more videos
  const loadMoreVideos = async () => {
    if (!user) {
      const allVideos = await fetchVideos();
      setVideos(prev => {
        const newVideos = allVideos.filter(
          newVideo => !prev.some(existingVideo => existingVideo.id === newVideo.id)
        );
        return [...prev, ...newVideos];
      });
    } else {
      const recommended = await recommendVideos(user.uid);
      setVideos(prev => {
        const newVideos = recommended.filter(
          newVideo => !prev.some(existingVideo => existingVideo.id === newVideo.id)
        );
        return [...prev, ...newVideos];
      });
    }
  };

  // Load initial videos
  useEffect(() => {
    const loadInitialVideos = async () => {
      try {
        if (user) {
          const recommended = await recommendVideos(user.uid);
          setVideos(recommended);
        } else {
          const allVideos = await fetchVideos();
          setVideos(allVideos);
        }
      } catch (error) {
        console.error("Error loading videos:", error);
      }
    };

    loadInitialVideos();
  }, [user]);

  // Function to update video in videos array
  const updateVideoInList = (videoId: string, updateFn: (video: VideoType) => VideoType) => {
    setVideos(prevVideos => 
      prevVideos.map(video => 
        video.id === videoId ? updateFn(video) : video
      )
    );

    if (currentVideo?.id === videoId) {
      setCurrentVideo(prev => prev ? updateFn(prev) : null);
    }
  };

  // Function to update video likes
  const updateVideoLikes = async (videoId: string, userId: string, username: string, isAdding: boolean) => {
    const videoDocRef = doc(db, "videos", videoId);
    const timestamp = new Date().toISOString();
    const likeData = { username, timestamp };

    try {
      await updateDoc(videoDocRef, {
        likes: isAdding ? arrayUnion(likeData) : arrayRemove(likeData)
      });

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

  // Function to update video dislikes
  const updateVideoDislikes = async (videoId: string, userId: string, username: string, isAdding: boolean) => {
    const videoDocRef = doc(db, "videos", videoId);
    const timestamp = new Date().toISOString();
    const dislikeData = { username, timestamp };

    try {
      await updateDoc(videoDocRef, {
        dislikes: isAdding ? arrayUnion(dislikeData) : arrayRemove(dislikeData)
      });

      updateVideoInList(videoId, video => ({
        ...video,
        dislikes: isAdding 
          ? [...video.dislikes, dislikeData]
          : video.dislikes.filter(dislike => dislike.username !== username)
      }));
    } catch (error) {
      console.error("Error updating video dislikes:", error);
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
    updateVideoDislikes,
    updateVideoComments,
    fetchVideos,
    recommendVideos,
  };
} 