// Interface representing a video object
// Includes video metadata and user interactions

export interface VideoType {
  id: string;
  url: string;
  name: string;
  uploaderName: string;
  uploaderId: string;
  comments: { username: string; text: string; timestamp: string }[];
  likes: { username: string; timestamp: string }[];
  category: string;
  timestamp?: string;
}

// Unique identifier for the video
// URL where the video is hosted
// Name or title of the video
// Name of the user who uploaded the video
// Unique identifier of the uploader
// Array of comments on the video, each with a username, text, and timestamp
// Array of likes on the video, each with a username and timestamp
// Category or genre of the video
// Optional timestamp of when the video was uploaded

// Interface representing a user object
// Includes basic user information

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
} 