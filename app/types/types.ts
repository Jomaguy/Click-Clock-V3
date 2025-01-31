export interface VideoType {
  id: string;
  url: string;
  name: string;
  uploaderName: string;
  uploaderId: string;
  comments: { username: string; text: string; timestamp: string }[];
  likes: { username: string; timestamp: string }[];
  dislikes: { username: string; timestamp: string }[];
  category: string;
  isPlaying?: boolean;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
} 