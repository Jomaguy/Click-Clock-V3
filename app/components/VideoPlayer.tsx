"use client";

import { useRef, useEffect } from 'react';
import { useInteractionTracking } from '../hooks/useInteractionTracking';
import { User } from 'firebase/auth';

interface VideoPlayerProps {
  video: {
    id: string;
    url: string;
    name: string;
    uploaderName: string;
    uploaderId: string;
    comments: { username: string; text: string; timestamp: string }[];
    likes: { username: string; timestamp: string }[];
    category: string;
    score?: number;
    matchReasons?: string[];
  };
  index: number;
  isPlaying: boolean;
  user: User | null;
  onVideoRefAction: (el: HTMLDivElement | null, index: number) => void;
  onTogglePlayPauseAction: (index: number) => void;
  onVideoVisibleAction: (video: VideoPlayerProps['video']) => void;
}

export default function VideoPlayer({ 
  video, 
  index, 
  isPlaying,
  user,
  onVideoRefAction,
  onTogglePlayPauseAction,
  onVideoVisibleAction,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const userInteractedRef = useRef(false);
  const isPlayingRef = useRef(false);
  
  // Initialize interaction tracking
  const { initializeInteraction, updateWatchPercentage } = useInteractionTracking(user?.uid || null);

  // Track video progress
  useEffect(() => {
    if (!videoRef.current || !user) return;

    let lastUpdateTime = 0;
    let hasReachedEnd = false;

    const handleTimeUpdate = () => {
      if (!videoRef.current) return;
      
      const currentTime = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      
      // Only update every second to reduce console spam
      if (currentTime - lastUpdateTime >= 1) {
        lastUpdateTime = currentTime;
        
        if (duration > 0) {
          // If we've reached the end before, keep it at 100%
          if (hasReachedEnd) {
            updateWatchPercentage(video.id, 100);
            return;
          }

          const percentage = (currentTime / duration) * 100;
          updateWatchPercentage(video.id, percentage);
        }
      }
    };

    const handleEnded = () => {
      hasReachedEnd = true;
      updateWatchPercentage(video.id, 100);
    };

    videoRef.current.addEventListener('timeupdate', handleTimeUpdate);
    videoRef.current.addEventListener('ended', handleEnded);

    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        videoRef.current.removeEventListener('ended', handleEnded);
      }
    };
  }, [video.id, user, updateWatchPercentage]);

  const handlePlayback = async (shouldPlay: boolean) => {
    if (!videoRef.current || isPlayingRef.current === shouldPlay) return;
    
    isPlayingRef.current = shouldPlay;
    
    try {
      if (shouldPlay) {
        // Pause all other videos first
        const promises = Array.from(document.querySelectorAll('video')).map(async (v) => {
          if (v !== videoRef.current && !v.paused) {
            try {
              await v.pause();
              // Get the index from the video id and update its state
              const videoIndex = parseInt(v.id.split('-')[1]);
              if (!isNaN(videoIndex)) {
                onTogglePlayPauseAction(videoIndex);
              }
            } catch (error) {
              if (error instanceof Error && error.name !== 'AbortError') {
                throw error;
              }
            }
          }
        });
        
        await Promise.all(promises);
        await videoRef.current.play();
      } else {
        await videoRef.current.pause();
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        throw error;
      }
    } finally {
      isPlayingRef.current = !videoRef.current.paused;
      if (isPlayingRef.current !== isPlaying) {
        onTogglePlayPauseAction(index);
      }
    }
  };

  // Handle video visibility changes
  useEffect(() => {
    let isHandlingVisibility = false;
    let timeoutId: NodeJS.Timeout;

    const handleVisibility = async (entry: IntersectionObserverEntry) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        if (!videoRef.current || isHandlingVisibility) return;
        
        isHandlingVisibility = true;
        
        try {
          if (entry.isIntersecting && entry.intersectionRatio > 0.7) {
            // Initialize interaction tracking when video becomes visible
            if (user) {
              await initializeInteraction(video.id, video.category);
            }
            
            // Only auto-play if user hasn't manually paused
            if (!userInteractedRef.current) {
              // Reset video to start when scrolling back to it
              if (videoRef.current && videoRef.current.duration && 
                  videoRef.current.currentTime === videoRef.current.duration) {
                videoRef.current.currentTime = 0;
              }
              
              onVideoVisibleAction(video);
              await handlePlayback(true);
            }
          } else if (!entry.isIntersecting) {
            await handlePlayback(false);
          }
        } finally {
          isHandlingVisibility = false;
        }
      }, 100);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(handleVisibility);
      },
      { 
        threshold: [0, 0.7, 1],
        rootMargin: '-10% 0px'
      }
    );

    if (videoRef.current) {
      observer.observe(videoRef.current);
      
      // Add ended event listener to reset video
      const handleEnded = () => {
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          isPlayingRef.current = false;
          onTogglePlayPauseAction(index);
        }
      };
      
      videoRef.current.addEventListener('ended', handleEnded);

      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (videoRef.current) {
          videoRef.current.removeEventListener('ended', handleEnded);
          observer.unobserve(videoRef.current);
        }
        observer.disconnect();
      };
    }
  }, [video, onVideoVisibleAction, user, initializeInteraction]);

  // Add loadedmetadata event listener
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      // Video is now loaded and duration is available
      if (video.duration && video.currentTime === video.duration) {
        video.currentTime = 0;
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  const handleVideoClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!videoRef.current) return;
    
    // Set user interaction state to true when manually pausing
    userInteractedRef.current = !videoRef.current.paused;
    
    try {
      await handlePlayback(videoRef.current.paused);
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        throw error;
      }
    }
  };

  return (
    <div
      ref={(el) => onVideoRefAction(el, index)}
      className="h-screen w-full snap-mandatory snap-center relative bg-black flex items-center justify-center"
      style={{ scrollSnapAlign: 'center', scrollSnapStop: 'always' }}
    >
      <div className="relative flex items-center justify-center h-full w-full max-w-[1200px] mx-auto">
        {/* Video Element */}
        <video
          ref={videoRef}
          id={`video-${index}`}
          src={video.url}
          className="w-auto h-full object-contain mx-auto"
          style={{ maxHeight: '90vh' }}
          controls={false}
          onClick={handleVideoClick}
          playsInline
        />

        {/* Score Overlay */}
        {video.score !== undefined && (
          <div className="absolute top-4 right-4 bg-black/50 p-2 rounded-lg text-white">
            <div className="font-bold">Score: {Math.round(video.score)}</div>
            {video.matchReasons && video.matchReasons.length > 0 && (
              <div className="text-sm mt-1">
                {video.matchReasons.map((reason, i) => (
                  <div key={i} className="text-gray-200">{reason}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Play/Pause Overlay Button */}
        {!isPlaying && (
          <button
            onClick={handleVideoClick}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-20 h-20 flex items-center justify-center rounded-full bg-black/50">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </button>
        )}

        {/* Video Information Overlay */}
        <div className="absolute bottom-4 left-0 right-0 text-white z-10 text-center">
          <h3 className="text-xl font-semibold">{video.name}</h3>
          <p className="text-base opacity-60">@{video.uploaderName}</p>
        </div>
      </div>
    </div>
  );
} 