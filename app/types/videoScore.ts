import { VideoType } from './types';

export interface VideoScore {
  video: VideoType;
  score: number;
  matchReasons: string[];
} 