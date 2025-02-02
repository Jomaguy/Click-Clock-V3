import { VideoType } from './types';

// Interface representing the score of a video
// Includes the video details, score, and reasons for the score

export interface VideoScore {
  video: VideoType; // The video being scored
  score: number; // The calculated score for the video
  matchReasons: string[]; // Reasons or factors contributing to the score
} 
