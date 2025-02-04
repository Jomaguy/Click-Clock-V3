"use client";

import { useEffect, useRef, useCallback } from 'react';
import VideoPlayer from './VideoPlayer';
import { VideoType } from '../types/types';
import { User } from 'firebase/auth';
import styles from '../page.module.css';

interface VideoFeedProps {
  videos: VideoType[];
  user: User | null;
  isPlaying: { [key: number]: boolean };
  onVideoVisibleAction: (video: VideoType) => void;
  onTogglePlayPauseAction: (index: number) => void;
  onLoadMoreAction: () => Promise<void>;
}

// VideoFeed component to display a list of videos with infinite scroll
export default function VideoFeed({
  videos,
  user,
  isPlaying,
  onVideoVisibleAction,
  onTogglePlayPauseAction,
  onLoadMoreAction,
}: VideoFeedProps) {
  const videoRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isLoadingRef = useRef(false);

  // Debounced scroll handler for infinite scroll
  // Loads more videos when nearing the bottom of the list
  const handleScroll = useCallback(async (target: HTMLElement) => {
    if (isLoadingRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = target;
    // Load more when user is 1.5 screens away from the bottom
    if (scrollHeight - scrollTop <= clientHeight * 1.5) {
      isLoadingRef.current = true;
      await onLoadMoreAction();
      isLoadingRef.current = false;
    }
  }, [onLoadMoreAction]);

  // Set up scroll event listener for infinite scroll
  // Cleans up the event listener on component unmount
  useEffect(() => {
    const leftColumn = document.querySelector(`.${styles.leftColumn}`);
    if (!leftColumn) return;

    const scrollListener = async () => {
      await handleScroll(leftColumn as HTMLElement);
    };

    leftColumn.addEventListener("scroll", scrollListener);
    return () => {
      leftColumn.removeEventListener("scroll", scrollListener);
    };
  }, [handleScroll]);

  return (
    <div className={`${styles.leftColumn} scroll-smooth`} style={{ scrollSnapType: 'y mandatory', overscrollBehavior: 'contain' }}>
      {videos.map((video, index) => (
        <VideoPlayer
          key={video.id}
          video={video}
          index={index}
          isPlaying={isPlaying[index]}
          user={user}
          onVideoRefAction={(el) => {
            videoRefs.current[index] = el;
          }}
          onTogglePlayPauseAction={onTogglePlayPauseAction}
          onVideoVisibleAction={(video) => {
            onVideoVisibleAction(video);
          }}
        />
      ))}
    </div>
  );
} 