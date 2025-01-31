"use client";

import { useEffect, useRef, useCallback } from 'react';
import VideoPlayer from './VideoPlayer';
import { VideoType, User } from '../types/types';
import styles from '../page.module.css';

interface VideoFeedProps {
  videos: VideoType[];
  user: User | null;
  isPlaying: { [key: number]: boolean };
  onVideoVisibleAction: (video: VideoType) => void;
  onTogglePlayPauseAction: (index: number) => void;
  onLoadMoreAction: () => Promise<void>;
}

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