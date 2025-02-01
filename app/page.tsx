/*
App Structure and Component Overview:

This is the main application component that implements a video sharing platform similar to TikTok.
The app is divided into two main columns:

LEFT COLUMN:
- Video player with infinite scroll
- Displays videos based on user preferences (if logged in) or general content
- Handles video playback controls and autoplay

RIGHT COLUMN:
1. Comments Section
   - Displays comments for current video
   - Shows video information
2. Interaction Section
   - Comment input
   - Like/Unlike functionality
   - Share button
3. Authentication Section
   - Sign up/Sign in forms
   - Profile management
   - Video upload functionality
*/

"use client";

import styles from './page.module.css';
import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./lib/firebase";
import VideoFeed from "./components/VideoFeed";
import RightColumn from "./components/RightColumn";
import { useVideoManager } from './hooks/useVideoManager';
import ProfileModal from "./components/ProfileModal";

// Main application component for a video sharing platform similar to TikTok.
// Divided into two main columns: Video player (left) and User interactions (right).

export default function App() {
  // Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Use the video manager hook
  const {
    videos,
    currentVideo,
    isPlaying,
    setCurrentVideo,
    setIsPlaying,
    loadMoreVideos,
    updateVideoLikes,
    updateVideoComments,
  } = useVideoManager(user);

  // Effect to handle authentication state changes and load initial videos
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      try {
        await loadMoreVideos();
      } catch (error) {
        console.error("Error loading videos:", error);
      }
    });

    return () => unsubscribe();
  }, [loadMoreVideos]);

  // Render the main application layout with video feed and right column for interactions
  // Includes a modal for profile management when triggered

  return (
    <div className={styles.container}>
      <VideoFeed
        videos={videos}
        user={user}
        isPlaying={isPlaying}
        onVideoVisibleAction={setCurrentVideo}
        onTogglePlayPauseAction={(index) => {
          setIsPlaying(prev => ({ ...prev, [index]: !prev[index] }));
        }}
        onLoadMoreAction={loadMoreVideos}
      />

      <div className={styles.rightColumn}>
        <RightColumn
          user={user}
          currentVideo={currentVideo}
          onUpdateVideoLikesAction={updateVideoLikes}
          onUpdateVideoCommentsAction={updateVideoComments}
          onLoadMoreVideosAction={loadMoreVideos}
          onSetUserAction={setUser}
          onOpenProfileAction={() => setIsProfileModalOpen(true)}
        />
      </div>

      {isProfileModalOpen && (
        <ProfileModal
          user={user}
          onCloseAction={() => setIsProfileModalOpen(false)}
        />
      )}
    </div>
  );
}

// Return the JSX structure of the app with VideoFeed and RightColumn components
// VideoFeed handles video display and playback
// RightColumn manages user interactions like comments and likes
// ProfileModal is conditionally rendered for user profile management

