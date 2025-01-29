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

// Core React imports
import { useState, useEffect, useRef } from "react";

// Firebase Authentication imports
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  User,
} from "firebase/auth";

// Firebase Storage imports
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

// Firebase Firestore imports
import { 
  doc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  where, 
  query, 
  limit, 
  orderBy, 
  getDoc,
  collection, 
  getDocs,
  writeBatch 
} from "firebase/firestore";

// Local Firebase configuration
import { auth, storage, db } from "./lib/firebase";

// Available video categories
// These categories are used for both video uploads and user preferences
const VideoCategories = [
  "entertainment",
  "lifestyle",
  "education",
  "music",
  "fashion-beauty",
  "challenges-trends",
  "pets-animals",
  "gaming",
  "sports",
  "art-creativity",
];

// Main App Component
export default function App() {
  // Authentication States
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [dob, setDob] = useState<string>("");
  const [isSignUp, setIsSignUp] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);

  // Video Upload States
  const [uploading, setUploading] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [videoName, setVideoName] = useState<string>("");

  // User Preference States
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [userPreferences, setUserPreferences] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // Add this with your other state declarations at the top
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenPlaying, setIsFullscreenPlaying] = useState<{ [key: number]: boolean }>({});
  // User Authentication State
  const [userId, setUserId] = useState<string | null>(null);

  // Video Display and Interaction States
  const [videos, setVideos] = useState<{
    id: string,
    url: string;
    name: string;
    uploaderName: string;
    uploaderId: string;
    comments: { username: string; text: string; timestamp: string }[];
    likes: { username: string; timestamp: string }[];
    dislikes: { username: string; timestamp: string }[];  // Add this line
    category: string;
  }[]>([]);
  
  const [currentVideo, setCurrentVideo] = useState<{
    id: string;
    url: string;
    name: string;
    uploaderName: string;
    uploaderId: string;
    comments: { username: string; text: string; timestamp: string }[];
    likes: { username: string; timestamp: string }[];
    dislikes: { username: string; timestamp: string }[];  // Add this line
    category: string;
    isPlaying?: boolean;
  } | null>(null);

  // Comment States
  const [comment, setComment] = useState<string>("");
  const [userComments, setUserComments] = useState<UserComment[]>([]);

  // Profile Modal States
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [userVideos, setUserVideos] = useState<UploadedVideo[]>([]);
  const [likedVideos, setLikedVideos] = useState<{ videoName: string; }[]>([]);
  const [dislikedVideos, setDislikedVideos] = useState<{ videoName: string; }[]>([]);

  // Video Player References and States
  const videoRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [isPlaying, setIsPlaying] = useState<{ [key: number]: boolean }>({});

  // TypeScript Interfaces
  interface UserComment {
    videoName: string;
    content: string;
    timestamp: string;
  }

  interface UploadedVideo {
    name: string;
    category: string;
  }

  interface UserInfo {
    name?: string;
    username?: string;
    email?: string;
    dob?: string;
    interests?: string[];
    videos?: { name: string; likes?: string[] }[];
    subscriptions: string[];  // Array of creator IDs the user is subscribed to
  }

  // New state for subscription
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Add this with your other state declarations
  const [creatorNames, setCreatorNames] = useState<{[key: string]: string}>({});

  // Function to load more videos when user scrolls
  // This supports infinite scrolling functionality
  const loadMoreVideos = async () => {
    if (!user) {
      // For non-signed in users: fetch general videos
      const allVideos = await fetchVideos();
      setVideos(prev => {
        // Combine existing videos with new ones, avoiding duplicates
        const newVideos = allVideos.filter(
          newVideo => !prev.some(existingVideo => existingVideo.id === newVideo.id)
        );
        return [...prev, ...newVideos];
      });
    } else {
      // For signed-in users: fetch personalized recommendations
      const recommended = await recommendVideos(user.uid);
      setVideos(prev => {
        // Combine existing videos with new recommendations, avoiding duplicates
        const newVideos = recommended.filter(
          newVideo => !prev.some(existingVideo => existingVideo.id === newVideo.id)
        );
        return [...prev, ...newVideos];
      });
    }
  };

  // Update your useEffect for auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Check if user is subscribed when component mounts
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!userId || !currentVideo) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        const userData = userDoc.data();
        
        // Check if current video creator is in user's subscriptions
        setIsSubscribed(userData?.subscriptions?.includes(currentVideo?.uploaderId) || false);
      } catch (error) {
        console.error('Error checking subscription status:', error);
      }
    };
    
    checkSubscriptionStatus();
  }, [userId, currentVideo?.uploaderId]);

  const handleSubscribe = async () => {
    if (!userId) {
      alert("Please log in to subscribe");
      return;
    }

    if (!currentVideo?.uploaderId) {
      alert("Cannot find video creator");
      return;
    }

    const userRef = doc(db, 'users', userId);
    
    try {
      if (isSubscribed) {
        // Unsubscribe: Remove creator from user's subscriptions
        await updateDoc(userRef, {
          subscriptions: arrayRemove(currentVideo.uploaderId)
        });
        setIsSubscribed(false);
        alert("Unsubscribed successfully!");
      } else {
        // Subscribe: Add creator to user's subscriptions
        await updateDoc(userRef, {
          subscriptions: arrayUnion(currentVideo.uploaderId)
        });
        setIsSubscribed(true);
        alert("Subscribed successfully!");
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
      alert("Error updating subscription. Please try again.");
    }
  };

  // Add this toggle function with your other functions
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      // Entering fullscreen - existing code remains the same
      const currentIndex = videos.findIndex(v => v.id === currentVideo?.id);
      const normalVideo = document.querySelector(`#video-${currentIndex}`) as HTMLVideoElement;
      const currentTime = normalVideo?.currentTime || 0;

      videos.forEach((_, index) => {
        const normalVideo = document.querySelector(`#video-${index}`) as HTMLVideoElement;
        if (normalVideo) {
          normalVideo.pause();
          setIsPlaying(prev => ({ ...prev, [index]: false }));
        }
      });

      setTimeout(() => {
        const fullscreenVideo = document.querySelector(`#video-${currentIndex}-fullscreen`) as HTMLVideoElement;
        if (fullscreenVideo) {
          fullscreenVideo.currentTime = currentTime;
          fullscreenVideo.scrollIntoView({ behavior: 'auto' });
        }
      }, 0);
    } else {
      // Exiting fullscreen - find the currently playing video in fullscreen
      const playingIndex = Object.entries(isFullscreenPlaying)
        .find(([_, isPlaying]) => isPlaying)?.[0];
      
      if (playingIndex) {
        const index = parseInt(playingIndex);
        const fullscreenVideo = document.querySelector(`#video-${index}-fullscreen`) as HTMLVideoElement;
        const currentTime = fullscreenVideo?.currentTime || 0;

        // Pause all fullscreen videos
        videos.forEach((_, idx) => {
          const fullscreenVideo = document.querySelector(`#video-${idx}-fullscreen`) as HTMLVideoElement;
          if (fullscreenVideo) {
            fullscreenVideo.pause();
            setIsFullscreenPlaying(prev => ({ ...prev, [idx]: false }));
          }
        });

        // After exiting, scroll to and play the same video in left column
        setTimeout(() => {
          const normalVideo = document.querySelector(`#video-${index}`) as HTMLVideoElement;
          if (normalVideo) {
            normalVideo.currentTime = currentTime;
            normalVideo.scrollIntoView({ behavior: 'auto' });
            normalVideo.play();
            setIsPlaying(prev => ({ ...prev, [index]: true }));
            setCurrentVideo({ ...videos[index], isPlaying: true });
          }
        }, 0);
      }
    }
    
    setIsFullscreen(!isFullscreen);
  };

  useEffect(() => {
    if (isFullscreen) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const videoIndex = videoRefs.current.findIndex(ref => ref === entry.target);
            if (videoIndex === -1) return;

            const fullscreenVideo = document.querySelector(`#video-${videoIndex}-fullscreen`) as HTMLVideoElement;
            
            if (entry.isIntersecting) {
              // Video is visible
              console.log(`Video ${videoIndex} is visible`); // Debug log
              if (fullscreenVideo && fullscreenVideo.paused) {
                fullscreenVideo.play();
                setIsFullscreenPlaying(prev => ({ ...prev, [videoIndex]: true }));
              }
            } else {
              // Video is not visible
              console.log(`Video ${videoIndex} is not visible`); // Debug log
              if (fullscreenVideo && !fullscreenVideo.paused) {
                fullscreenVideo.pause();
                setIsFullscreenPlaying(prev => ({ ...prev, [videoIndex]: false }));
              }
            }
          });
        },
        {
          threshold: 0.8 // Video needs to be 80% visible to trigger
        }
      );

      // Observe all video containers
      videoRefs.current.forEach((ref) => {
        if (ref) {
          observer.observe(ref);
        }
      });

      return () => {
        observer.disconnect();
      };
    }
  }, [isFullscreen]);

  // Handles video playback based on scroll position
  // Automatically plays/pauses videos as they enter/leave viewport
  const handleScroll = async () => {
    if (!videoRefs.current) return;

    try {
      await Promise.all(videoRefs.current.map(async (ref, index) => {
        if (ref) {
          const rect = ref.getBoundingClientRect();
          const videoElement = document.querySelector(`#video-${index}`) as HTMLVideoElement;
          
          if (!videoElement) return;

          // Check if video is fully visible in the viewport
          if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
            // Video is visible - play it and update states
            if (videoElement.paused) {
              try {
                await videoElement.play();
                setIsPlaying(prev => ({ ...prev, [index]: true }));
                setCurrentVideo({ ...videos[index], isPlaying: true });
              } catch (error) {
                if (error instanceof Error && error.name !== 'AbortError') {
                  console.error('Error playing video:', error);
                }
              }
            }
          } else {
            // Video is not visible - pause it
            if (!videoElement.paused) {
              try {
                await videoElement.pause();
                setIsPlaying(prev => ({ ...prev, [index]: false }));
              } catch (error) {
                if (error instanceof Error && error.name !== 'AbortError') {
                  console.error('Error pausing video:', error);
                }
              }
            }
          }
        }
      }));
    } catch (error) {
      console.error('Error in scroll handler:', error);
    }
  };
  
  // Sets up scroll event listener for the left column
  // This enables auto-play/pause functionality as user scrolls
  useEffect(() => {
    const leftColumn = document.querySelector(".left-column");
    if (leftColumn) {
      leftColumn.addEventListener("scroll", handleScroll);
    }
  
    // Cleanup function to remove event listener
    return () => {
      if (leftColumn) {
        leftColumn.removeEventListener("scroll", handleScroll);
      }
    };
  }, [videos, currentVideo]);

  // Fetches all videos from Firestore
  // Used for non-authenticated users or as base for recommendations
  const fetchVideos = async () => {
    try {
      const videosCollectionRef = collection(db, "videos");
      const querySnapshot = await getDocs(videosCollectionRef);
  
      const allVideos = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id, // Include Firestore document ID
          url: data.url,
          name: data.name || "Unnamed Video",
          uploaderName: data.uploaderName,
          uploaderId: data.uploaderId,
          comments: data.comments || [],
          likes: data.likes || [],
          dislikes: data.dislikes || [],  // Add this line
          category: data.category || "Uncategorized",
        };
      });
      return allVideos;
    } catch (error) {
      console.error("Error fetching videos:", error);
      return []; // Return empty array in case of error
    }
  };
  
  // Function to fetch user preferences from Firestore
  // Returns an array of category preferences for the given user
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
  // Returns a sorted array of videos, prioritizing user's preferred categories
  const recommendVideos = async (userId: string) => {
    try {
      // Fetch user preferences
      const userPreferences = await fetchUserPreferences(userId);

      const videosCollectionRef = collection(db, "videos");

      let preferredVideos: any[] = [];
      let nonPreferredVideos: any[] = [];

      // Fetch videos that match user's preferred categories
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
            dislikes: data.dislikes || [],  // Add this line
            category: data.category,
          };
        });
      }

      // Fetch all videos and filter out preferred ones
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
            dislikes: data.dislikes || [],  // Add this line
            category: data.category,
          };
        })
        .filter((video) => !userPreferences.includes(video.category)); // Exclude preferred categories

      // Combine and sort videos
      const allRecommendedVideos = [...preferredVideos, ...nonPreferredVideos];

      // Sort videos by number of likes
      const sortedVideos = allRecommendedVideos.sort(
        (a, b) => b.likes.length - a.likes.length
      );

      // Return limited results (currently set to 100)
      // TODO: Implement proper pagination for infinite scroll
      return sortedVideos.slice(0, 100);
    } catch (error) {
      console.error("Error recommending videos:", error);
      return [];
    }
  };

  // Effect hook to load initial videos based on auth state
  useEffect(() => {
    const loadVideos = async (currentUser: any) => {
      try {
        if (currentUser) {
          // Signed-in user: fetch recommended videos
          const userId = currentUser.uid;
          const recommended = await recommendVideos(userId);
          setVideos(recommended);
        } else {
          // Non-signed-in user: fetch general videos
          const allVideos = await fetchVideos();
          setVideos(allVideos);
        }
      } catch (error) {
        console.error("Error loading videos:", error);
      }
    };

    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // Load videos based on the current auth state
      loadVideos(currentUser);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Function to toggle play/pause state of videos
  // Ensures only one video plays at a time
  const togglePlayPause = async (index: number, isFullscreenVideo: boolean = false) => {
    const videoElement = isFullscreenVideo 
      ? document.querySelector(`#video-${index}-fullscreen`) as HTMLVideoElement
      : document.querySelector(`#video-${index}`) as HTMLVideoElement;
    
    if (!videoElement) return;

    try {
      // Pause all other videos first
      await Promise.all(videos.map(async (_, idx) => {
        if (idx !== index) {
          const otherVideo = document.querySelector(
            isFullscreenVideo ? `#video-${idx}-fullscreen` : `#video-${idx}`
          ) as HTMLVideoElement;
          if (otherVideo && !otherVideo.paused) {
            await otherVideo.pause();
            if (isFullscreenVideo) {
              setIsFullscreenPlaying(prev => ({ ...prev, [idx]: false }));
            } else {
              setIsPlaying(prev => ({ ...prev, [idx]: false }));
            }
          }
        }
      }));

      // Then handle the clicked video
      if (videoElement.paused) {
        try {
          await videoElement.play();
          if (isFullscreenVideo) {
            setIsFullscreenPlaying(prev => ({ ...prev, [index]: true }));
          } else {
            setIsPlaying(prev => ({ ...prev, [index]: true }));
          }
          setCurrentVideo({ ...videos[index], isPlaying: true });
        } catch (error) {
          console.error('Error playing video:', error);
        }
      } else {
        await videoElement.pause();
        if (isFullscreenVideo) {
          setIsFullscreenPlaying(prev => ({ ...prev, [index]: false }));
        } else {
          setIsPlaying(prev => ({ ...prev, [index]: false }));
        }
        setCurrentVideo({ ...videos[index], isPlaying: false });
      }
    } catch (error) {
      console.error('Error toggling video playback:', error);
    }
  };

  // Function to add new comment to a video
  // Updates both Firestore and local state
  const handleAddComment = async () => {
    if (!user) {
      alert("You must be logged in to comment.");
      return;
    }

    if (!currentVideo) {
      alert("No video is currently visible.");
      return;
    }

    if (!comment.trim()) {
      alert("Comment cannot be empty.");
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      // Prepare comment data for user's profile
      const commentDataForUser = {
        content: comment.trim(),
        videoName: currentVideo.name || "Unnamed Video",
        url: currentVideo.url,
        timestamp,
      };

      // Prepare comment data for video document
      const commentDataForVideo = {
        username: user.displayName || name || user.email || "Anonymous",
        text: comment.trim(),
        timestamp,
      };

      // Update user's document with new comment
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        comments: arrayUnion(commentDataForUser),
      });

      // Update local userComments state immediately
      setUserComments(prevComments => [...prevComments, commentDataForUser]);

      // Find and update the video document
      const videosCollectionRef = collection(db, "videos");
      const querySnapshot = await getDocs(videosCollectionRef);

      let videoDocRef = null;

      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        if (data.url === currentVideo.url) {
          videoDocRef = doc(db, "videos", docSnapshot.id);
        }
      });

      if (videoDocRef) {
        // Update video document with new comment
        await updateDoc(videoDocRef, {
          comments: arrayUnion(commentDataForVideo),
        });

        // Update local states to reflect new comment
        setCurrentVideo((prevVideo) => {
          if (!prevVideo) return prevVideo;
          return {
            ...prevVideo,
            comments: [...prevVideo.comments, commentDataForVideo],
          };
        });

        setVideos((prevVideos) =>
          prevVideos.map((video) =>
            video.url === currentVideo.url
              ? { ...video, comments: [...video.comments, commentDataForVideo] }
              : video
          )
        );

        alert("Comment added successfully!");
      } else {
        console.error("No matching video found in the videos collection.");
        alert("Failed to update the video collection. Video not found.");
      }

      setComment(""); // Reset the comment input field
    } catch (error) {
      console.error("Error adding comment:", error);
      alert("Failed to add comment. Please try again.");
    }
  };

  // Function to handle liking/unliking videos
  // Updates both Firestore and local states
  const handleLike = async () => {
    if (!user) {
      alert("You must be logged in to like a video.");
      return;
    }

    if (!currentVideo) {
      alert("No video selected.");
      return;
    }

    try {
      const userDocRef = doc(db, "users", user.uid);
      const videoDocRef = doc(db, "videos", currentVideo.id);

      const userDoc = await getDoc(userDocRef);
      const videoDoc = await getDoc(videoDocRef);

      // Check if user has already liked the video
      const userLikes = userDoc.exists() ? userDoc.data().likes || [] : [];
      const alreadyLiked = userLikes.some((like: { url: string }) => like.url === currentVideo.url);

      const timestamp = new Date().toISOString();
      // Prepare like data for user's profile
      const userLikeData = {
        timestamp,
        url: currentVideo.url,
        videoName: currentVideo.name,
      };

      // Prepare like data for video document
      const videoLikeData = {
        timestamp,
        username: user.displayName || user.email || "Anonymous",
      };

      if (alreadyLiked) {
        // Unlike: Remove the like data
        await updateDoc(userDocRef, {
          likes: arrayRemove(...userLikes.filter((like: { url: string }) => like.url === currentVideo.url))
        });
        await updateDoc(videoDocRef, {
          likes: arrayRemove(...(videoDoc.data()?.likes || []).filter((like: { username: string }) => 
            like.username === (user.displayName || user.email || "Anonymous")
          ))
        });

        // Update local states for unlike
        setVideos(prevVideos => 
          prevVideos.map(video => 
            video.id === currentVideo.id 
              ? {
                  ...video,
                  likes: video.likes.filter(like => 
                    like.username !== (user.displayName || user.email || "Anonymous")
                  )
                }
              : video
          )
        );

        setCurrentVideo(prev => 
          prev ? {
            ...prev,
            likes: prev.likes.filter(like => 
              like.username !== (user.displayName || user.email || "Anonymous")
            )
          } : null
        );

        // Update likedVideos state for the modal
        setLikedVideos(prev => prev.filter(video => video.videoName !== currentVideo.name));

        alert("Video unliked successfully!");
      } else {
        // Like: Add the like data
        await updateDoc(userDocRef, {
          likes: arrayUnion(userLikeData),
        });

        await updateDoc(videoDocRef, {
          likes: arrayUnion(videoLikeData),
        });

        // Update local states for like
        setVideos(prevVideos => 
          prevVideos.map(video => 
            video.id === currentVideo.id 
              ? {
                  ...video,
                  likes: [...video.likes, videoLikeData]
                }
              : video
          )
        );

        setCurrentVideo(prev => 
          prev ? {
            ...prev,
            likes: [...prev.likes, videoLikeData]
          } : null
        );

        // Update likedVideos state for the modal
        setLikedVideos(prev => [...prev, { videoName: currentVideo.name }]);

        alert("Video liked successfully!");
      }

    } catch (error) {
      console.error("Error toggling like:", error);
      alert("Failed to update like status. Please try again.");
    }
  };

  const handleDislike = async () => {
    if (!user) {
      alert("You must be logged in to dislike a video.");
      return;
    }
  
    if (!currentVideo) {
      alert("No video selected.");
      return;
    }
  
    try {
      const userDocRef = doc(db, "users", user.uid);
      const videoDocRef = doc(db, "videos", currentVideo.id);
  
      const userDoc = await getDoc(userDocRef);
      const videoDoc = await getDoc(videoDocRef);
  
      // Check if user has already disliked the video
      const userDislikes = userDoc.exists() ? userDoc.data().dislikes || [] : [];
      const alreadyDisliked = userDislikes.some((dislike: { url: string }) => dislike.url === currentVideo.url);
  
      const timestamp = new Date().toISOString();
      // Prepare dislike data for user's profile
      const userDislikeData = {
        timestamp,
        url: currentVideo.url,
        videoName: currentVideo.name,
      };
  
      // Prepare dislike data for video document
      const videoDislikeData = {
        timestamp,
        username: user.displayName || user.email || "Anonymous",
      };
  
      if (alreadyDisliked) {
        // Remove dislike: Remove the dislike data
        await updateDoc(userDocRef, {
          dislikes: arrayRemove(...userDislikes.filter((dislike: { url: string }) => dislike.url === currentVideo.url))
        });
        await updateDoc(videoDocRef, {
          dislikes: arrayRemove(...(videoDoc.data()?.dislikes || []).filter((dislike: { username: string }) => 
            dislike.username === (user.displayName || user.email || "Anonymous")
          ))
        });
  
        // Update local states for removing dislike
        setVideos(prevVideos => 
          prevVideos.map(video => 
            video.id === currentVideo.id 
              ? {
                  ...video,
                  dislikes: video.dislikes?.filter(dislike => 
                    dislike.username !== (user.displayName || user.email || "Anonymous")
                  ) || []
                }
              : video
          )
        );
  
        setCurrentVideo(prev => 
          prev ? {
            ...prev,
            dislikes: prev.dislikes?.filter(dislike => 
              dislike.username !== (user.displayName || user.email || "Anonymous")
            ) || []
          } : null
        );
  
        alert("Video dislike removed successfully!");
      } else {
        // Dislike: Add the dislike data
        await updateDoc(userDocRef, {
          dislikes: arrayUnion(userDislikeData),
        });
  
        await updateDoc(videoDocRef, {
          dislikes: arrayUnion(videoDislikeData),
        });
  
        // Update local states for dislike
        setVideos(prevVideos => 
          prevVideos.map(video => 
            video.id === currentVideo.id 
              ? {
                  ...video,
                  dislikes: [...(video.dislikes || []), videoDislikeData]
                }
              : video
          )
        );
  
        setCurrentVideo(prev => 
          prev ? {
            ...prev,
            dislikes: [...(prev.dislikes || []), videoDislikeData]
          } : null
        );
  
        alert("Video disliked successfully!");
      }
  
    } catch (error) {
      console.error("Error toggling dislike:", error);
      alert("Failed to update dislike status. Please try again.");
    }
  };
  
  
  
  







  // Function to handle video sharing
  // Uses Web Share API if available, falls back to clipboard copy
  const handleShare = async (video: any) => {
    try {
      if (navigator.share) {
        // Use Web Share API if available
        await navigator.share({
          title: video.name || 'Check out this video!',
          text: `Watch this video from ${video.uploaderName}`,
          url: window.location.href
        });
      } else {
        // Fallback: Copy URL to clipboard
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      alert('Failed to share video');
    }
  };

  // Handle user sign-up or sign-in
  // Creates new user account or authenticates existing user
  const handleAuth = async () => {
    try {
      if (isSignUp) {
        // Validate category selection for new users
        if (selectedCategories.length === 0) {
          alert("Please select at least one category.");
          return;
        }

        // Create new user account
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        const userDoc = doc(db, "users", user.uid);
        
        // Initialize user document with profile information
        await setDoc(userDoc, {
          name,
          username,
          email,
          dob,
          interests: selectedCategories, // Save selected categories here
          videos: [],
        });
        alert("Sign-up successful!");
      } else {
        // Sign in existing user
        await signInWithEmailAndPassword(auth, email, password);
        alert("Sign-in successful!");
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "An unknown error occurred");
    }
  };

  // Monitor authentication state
  useEffect(() => {
    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user || null); // Update user state when auth state changes
    });

    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, []);

  // Function to toggle the profile modal visibility
  const toggleProfileModal = () => {
    setIsProfileModalOpen(!isProfileModalOpen);
  };

  // Function to fetch user information from Firestore
  const fetchUserInfo = async () => {
    if (!user) {
      console.error("User is not logged in.");
      return;
    }
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserInfo({
          ...data,
          subscriptions: data.subscriptions || []
        });
        
        // Fetch creator names if there are subscriptions
        if (data.subscriptions?.length > 0) {
          await fetchCreatorNames(data.subscriptions);
        }
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  };

  // Function to fetch liked videos for the user
  const fetchLikedVideos = async () => {
    if (!user) return;
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        setLikedVideos(data.likes || []);
      }
    } catch (error) {
      console.error("Error fetching liked videos:", error);
    }
  };

  // Function to fetch user's comments
  const fetchUserComments = async () => {
    if (!user) {
      console.error("User is not logged in.");
      return;
    }
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserComments(data.comments || []);
      }
    } catch (error) {
      console.error("Error fetching user comments:", error);
    }
  };

  // Function to fetch user's uploaded videos
  const fetchUserVideos = async () => {
    if (!user) {
      console.error("User is not logged in.");
      return;
    }
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserVideos(data.videos || []);
      }
    } catch (error) {
      console.error("Error fetching user videos:", error);
    }
  };

  // Effect hook to fetch user data when authenticated
  useEffect(() => {
    if (user) {
      fetchUserComments();
      fetchUserVideos();
      fetchUserInfo();
      fetchLikedVideos();
    }
  }, [user]);


 
  // Handle video upload
  // Processes file upload, saves to Firebase Storage, and updates Firestore
  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
      alert("Please log in to upload videos.");
      return;
    }
  
    if (!selectedCategory) {
      alert("Please select a category for your video.");
      return;
    }
  
    const file = event.target.files?.[0];
    if (!file) {
      alert("No file selected.");
      return;
    }
  
    if (file.size > 100 * 1024 * 1024) {
      alert("File size exceeds 100 MB.");
      return;
    }
  
    setUploading(true);
    // Create reference to storage location
    const storageRef = ref(storage, `videos/${selectedCategory}/${user.uid}/${file.name}`);
  
    try {
      // Upload file to Firebase Storage
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
  
      // Save video to user's profile
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        videos: arrayUnion({
          url: downloadURL,
          name: videoName.trim(), // Save the user-defined name
          category: selectedCategory,
          timestamp: new Date().toISOString(),
        }),
      });

      // Save video to global collection
      const videoDocRef = doc(collection(db, "videos")); // Generates a unique ID
      await setDoc(videoDocRef, {
        url: downloadURL,
        name: videoName.trim(), // Save the user-defined name
        category: selectedCategory,
        timestamp: new Date().toISOString(),
        uploaderName: user.displayName || name || user.email || "Unnamed",
        uploaderId: user.uid,
        comments: [],
        likes: [],
        dislikes: [],  // Add this line
      });
  
      alert("Video uploaded successfully!");
      setSelectedCategory(""); // Reset category
      fetchVideos(); // Fetch videos after upload
    } catch (error) {
      console.error("Error uploading video:", error);
      alert("Failed to upload video. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // Add this function to fetch creator names
const fetchCreatorNames = async (creatorIds: string[]) => {
  console.log('Fetching creator names for:', creatorIds);
  try {
    const names: {[key: string]: string} = {};
    for (const creatorId of creatorIds) {
      console.log('Fetching name for creator:', creatorId);
      const creatorDoc = await getDoc(doc(db, 'users', creatorId));
      console.log('Creator doc:', creatorDoc.data());
      const creatorData = creatorDoc.data();
      names[creatorId] = creatorData?.username || creatorData?.name || creatorData?.email || 'Unknown Creator';
    }
    console.log('Final creator names:', names);
    return names;
  } catch (error) {
    console.error('Error fetching creator names:', error);
    return {};
  }
};






  // All the code that has to do with the profileModal
  // Displays user information, liked videos, comments, and uploaded videos
  const ProfileModal = () => {
    console.log('ProfileModal rendered');  // Debug log

    // Fetch user information when modal opens
    useEffect(() => {
      console.log('ProfileModal useEffect triggered', user);  // Debug log
      if (user) {
        const fetchUserInfo = async () => {
          try {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
              const data = userDoc.data();
              console.log('User data fetched:', data);  // Debug log
              setUserInfo({
                ...data,
                subscriptions: data.subscriptions || []
              });
              
              // Fetch creator names if there are subscriptions
              if (data.subscriptions?.length > 0) {
                await fetchCreatorNames(data.subscriptions);
              }
            }
          } catch (error) {
            console.error("Error fetching user info:", error);
          }
        };

        fetchUserInfo();
      }
    }, [user]);

    // Add fetchCreatorNames function inside ProfileModal
    const fetchCreatorNames = async (creatorIds: string[]) => {
      console.log('Fetching creator names for:', creatorIds);  // Debug log
      try {
        const names: {[key: string]: string} = {};
        for (const creatorId of creatorIds) {
          const userDocRef = doc(db, "users", creatorId);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const data = userDoc.data();
            console.log('Creator data:', data);  // Debug log
            names[creatorId] = data.username || data.name || data.email || "Anonymous";
          }
        }
        console.log('Setting creator names:', names);  // Debug log
        setCreatorNames(names);
      } catch (error) {
        console.error('Error fetching creator names:', error);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div
          className="bg-black p-8 rounded-lg shadow-lg relative border border-white"
          style={{
            width: "100%",
            height: "100%",
            maxWidth: "2000px",
            maxHeight: "90%",
          }}
        >
          {/* Close Button */}
          <button
            onClick={toggleProfileModal}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <h2 className="text-2xl font-semibold mb-4 text-white">Profile</h2>

          {/* 5 Columns Grid Layout */}
          <div
            className="grid grid-cols-5 gap-4"
            style={{
              height: "calc(100% - 100px)",
            }}
          >
            {/* Column 1: User Information */}
            <div className="bg-gray-900 p-4 rounded-xl border border-white">
              <h3 className="text-lg font-medium text-white mb-4">User Information</h3>
              {userInfo ? (
                <div className="mt-4 space-y-4">
                  <p className="text-white">
                    <strong className="text-white opacity-80">Name:</strong> {userInfo.name || "N/A"}
                  </p>
                  <p className="text-white">
                    <strong className="text-white opacity-80">Username:</strong> {userInfo.username || "N/A"}
                  </p>
                  <p className="text-white">
                    <strong className="text-white opacity-80">Email:</strong> {user ? user.email : "N/A"}
                  </p>
                  <p className="text-white">
                    <strong className="text-white opacity-80">Date of Birth:</strong> {userInfo.dob || "N/A"}
                  </p>
                </div>
              ) : (
                <p className="text-white opacity-60 mt-4">Loading user information...</p>
              )}
            </div>

            {/* Column 2: Liked Videos */}
            <div className="bg-gray-900 p-4 rounded-xl border border-white">
              <h3 className="text-lg font-medium text-white mb-4">Liked Videos</h3>
              {likedVideos.length > 0 ? (
                <div className="mt-4 space-y-2 flex-grow overflow-y-auto">
                  {likedVideos.map((video, index) => (
                    <div 
                      key={index} 
                      className="p-4 bg-gray-800 border border-gray-700 text-white rounded-xl hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <svg 
                            className="w-5 h-5 text-red-500" 
                            fill="currentColor" 
                            viewBox="0 0 20 20"
                          >
                            <path 
                              fillRule="evenodd" 
                              d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" 
                              clipRule="evenodd" 
                            />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {video.videoName}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => alert('Feature coming soon!')}
                    className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    See Your Liked Videos
                  </button>
                </div>
              ) : (
                <div className="mt-4 p-6 bg-gray-800 rounded-xl border border-gray-700 text-center">
                  <svg 
                    className="mx-auto h-12 w-12 text-white opacity-60" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path 
                      fillRule="evenodd" 
                      d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" 
                      clipRule="evenodd" 
                    />
                  </svg>
                  <p className="mt-2 text-white opacity-60">No liked videos yet</p>
                  <button
                    onClick={() => alert('Feature coming soon!')}
                    className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    See Your Liked Videos
                  </button>
                </div>
              )}
            </div>

            {/* Column 3: User Comments */}
            <div className="bg-gray-900 p-4 rounded-xl border border-white">
              <h3 className="text-lg font-medium text-white mb-4">Your Comments</h3>
              {userComments.length > 0 ? (
                <div className="flex-grow overflow-y-auto space-y-2">
                  {userComments.map((comment, index) => (
                    <div 
                      key={index} 
                      className="p-4 bg-gray-800 border border-gray-700 rounded-xl hover:border-gray-600 transition-colors"
                    >
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center space-x-2">
                          <svg 
                            className="w-4 h-4 text-white opacity-60" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth="2" 
                              d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                            />
                          </svg>
                          <p className="text-sm font-semibold text-white">
                            {comment.videoName}
                          </p>
                        </div>
                        <p className="text-white pl-6">
                          {comment.content}
                        </p>
                        <p className="text-xs text-white opacity-60 pl-6">
                          {new Date(comment.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 p-6 bg-gray-800 rounded-xl border border-gray-700 text-center">
                  <svg 
                    className="mx-auto h-12 w-12 text-white opacity-60" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth="2" 
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <p className="mt-2 text-white opacity-60">No comments yet</p>
                </div>
              )}
            </div>

            {/* Column 4: Uploaded Videos */}
            <div className="bg-gray-900 p-4 rounded-xl border border-white">
              <h3 className="text-lg font-medium text-white mb-4">Your Uploaded Videos</h3>
              {userVideos.length > 0 ? (
                <div className="mt-4 space-y-2 flex-grow overflow-y-auto">
                  {userVideos.map((video, index) => (
                    <div 
                      key={index} 
                      className="p-4 bg-gray-800 border border-gray-700 rounded-xl hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <svg 
                            className="w-5 h-5 text-white opacity-60" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth="2" 
                              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {video.name || "Unnamed Video"}
                          </p>
                          <p className="text-xs text-white opacity-60">
                            Category: {video.category.replace("-", " ")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 p-6 bg-gray-800 rounded-xl border border-gray-700 text-center">
                  <svg 
                    className="mx-auto h-12 w-12 text-white opacity-60" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth="2" 
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="mt-2 text-white opacity-60">No uploaded videos yet</p>
                </div>
              )}
            </div>

            {/* Column 5: Subscriptions */}
            <div className="bg-gray-900 p-4 rounded-xl border border-white">
              <h3 className="text-lg font-medium text-white mb-4">Your Subscriptions</h3>
              {userInfo && userInfo.subscriptions && userInfo.subscriptions.length > 0 ? (
                <div className="mt-4 space-y-2 flex-grow overflow-y-auto">
                  {userInfo.subscriptions.map((creatorId, index) => {
                    console.log('Rendering subscription:', creatorId, creatorNames[creatorId]);  // Debug log
                    return (
                      <div 
                        key={index}
                        className="p-4 bg-gray-800 border border-gray-700 rounded-xl hover:border-gray-600 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <svg 
                              className="w-5 h-5 text-white opacity-60" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {creatorNames[creatorId] || 'Loading...'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 p-6 bg-gray-800 rounded-xl border border-gray-700 text-center">
                  <svg 
                    className="mx-auto h-12 w-12 text-white opacity-60" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="mt-2 text-white opacity-60">No subscriptions yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Main component return - Renders the entire application UI
  return (
    <main className="flex h-screen">
      {/* Left Column - Video Player */}
      <div className="w-1/2 bg-black overflow-y-scroll snap-y snap-mandatory h-screen left-column">
        <button className={styles.fullscreenBtn} onClick={toggleFullscreen}>
          Focus Mode
        </button>
        
        {videos.map((video, index) => (
          <div
            key={index}
            ref={(el) => {
              videoRefs.current[index] = el;
            }}
            className="h-screen w-full snap-start relative bg-black flex items-center justify-center"
          >
            <div className="relative flex items-center justify-center h-full w-full">
              {/* Video Element */}
              <video
                id={`video-${index}`}
                src={video.url}
                className="w-auto h-full object-contain mx-auto rounded-2xl"
                controls={false}
                onClick={() => togglePlayPause(index, false)}
              />

              {/* Play/Pause Overlay Button */}
              {!isPlaying[index] && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlayPause(index, false);
                  }}
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
        ))}
      </div>

      {/* Fullscreen Overlay */}
      {isFullscreen && (
        <div className={styles.fullscreenOverlay}>
          <div className={styles.fullscreenContent}>
            <button 
              onClick={toggleFullscreen}
              className={styles.closeButton}
            >
              Exit Focus Mode
            </button>
            
            <div className="bg-transparent w-full h-full overflow-y-scroll snap-y snap-mandatory">
              {videos.map((video, index) => (
                <div
                  key={index}
                  ref={(el) => {
                    videoRefs.current[index] = el;
                  }}
                  className="h-screen w-full snap-start relative flex items-center justify-center"
                >
                  <div className="relative flex items-center justify-center h-full w-full">
                    <video
                      id={`video-${index}-fullscreen`}
                      src={video.url}
                      className="w-auto h-full object-contain mx-auto"
                      controls={false}
                      onClick={() => togglePlayPause(index, true)}
                    />
                    {!isFullscreenPlaying[index] && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlayPause(index, true);
                        }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <div className="w-20 h-20 flex items-center justify-center rounded-full bg-black/50">
                          <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </button>
                    )}
                    <div className="absolute bottom-4 left-0 right-0 text-white z-10 text-center">
                      <h3 className="text-xl font-semibold">{video.name}</h3>
                      <p className="text-base opacity-60">@{video.uploaderName}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Right Column - Comments, Interactions, and Auth */}
      <div className="w-1/2 bg-black p-8 flex flex-col items-center space-y-4 h-full border-l border-white">
        {/* Row 1: Comments Display */}
        <div className="flex-grow h-full w-full border-b border-white p-6 overflow-y-auto bg-black">
          <h2 className="text-2xl text-white font-bold mb-6">Comments</h2>
          {currentVideo ? (
            <div className="space-y-4">
              {/* Video Information */}
              <div className="bg-gray-900 shadow-md rounded-xl p-5 border border-gray-800">
                <p className="text-xl text-white font-semibold mb-2">{currentVideo.name}</p>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-white opacity-60" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                  </svg>
                  <p className="text-sm text-white opacity-60">
                    Uploaded by: <span className="font-medium text-white">{currentVideo.uploaderName}</span>
                  </p>
                </div>
              </div>

              {/* Comments List */}
              {currentVideo.comments && currentVideo.comments.length > 0 ? (
                <div className="space-y-3">
                  {currentVideo.comments.map((comment, index) => (
                    <div
                      key={index}
                      className="bg-gray-900 p-4 rounded-xl shadow-lg border border-gray-800 hover:border-gray-700 transition-all"
                    >
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold">
                            {(comment.username || "Anonymous").charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {comment.username || "Anonymous"}
                          </p>
                          <p className="text-xs text-white opacity-60">
                            {new Date(comment.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <p className="text-white ml-10 font-poppins">{comment.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-gray-900 rounded-xl shadow-lg border border-gray-800">
                  <svg
                    className="mx-auto h-12 w-12 text-white opacity-60"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <p className="mt-2 text-white text-sm font-poppins">No comments yet. Be the first to comment!</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 bg-gray-900 rounded-xl shadow-lg border border-gray-800">
              <svg
                className="mx-auto h-12 w-12 text-white opacity-60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <p className="mt-2 text-white text-sm font-poppins">Scroll through the videos to see comments.</p>
            </div>
          )}
        </div>

        {/* Row 2: Add Comment Section */}
        <div className="flex-grow h-full w-full border-b border-white p-6 bg-black">
          <h2 className="text-lg text-white font-semibold">Add a Comment</h2>
          {currentVideo ? (
            <div className="mt-4">
              {/* Comment Input */}
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write your comment..."
                className="w-full px-4 py-2 bg-gray-900 border border-gray-800 text-white rounded-xl placeholder-gray-500 focus:outline-none focus:border-gray-700 focus:ring-1 focus:ring-gray-700"
                rows={3}
              ></textarea>
              {/* Action Buttons */}
              <button
                onClick={handleAddComment}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
              >
                Add Comment
              </button>
              <div className="mt-4 space-y-4">
                {/* Like Button */}
                <button
                  onClick={handleLike}
                  className={`mx-auto px-6 py-2 text-white rounded-xl hover:bg-opacity-80 transition-colors ${
                    currentVideo?.likes?.some((like) => 
                      like.username === (user?.displayName || user?.email)
                    )
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <svg 
                      className="w-5 h-5" 
                      fill="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        d="M2 20.054v-8.866h4V20.054H2zM22 11.188c0-.478-.193-.937-.536-1.28A1.824 1.824 0 0020.2 9.37h-5.034l.76-3.647.024-.247c0-.316-.126-.61-.347-.832L14.772 3.82 8.412 10.187c-.268.268-.412.621-.412.999v7.23c0 .779.632 1.412 1.412 1.412h7.794c.587 0 1.095-.362 1.305-.875l2.139-5.015c.063-.15.095-.314.095-.478V11.188z"
                      />
                    </svg>
                    <span>Like</span>
                  </div>
                </button>
                {/* Dislike Button */}
                <button
                  onClick={handleDislike}
                  className={`mx-auto px-6 py-2 text-white rounded-xl hover:bg-opacity-80 transition-colors ${
                    currentVideo?.dislikes?.some((dislike) => 
                      dislike.username === (user?.displayName || user?.email)
                    )
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <svg 
                      className="w-5 h-5" 
                      fill="currentColor" 
                      viewBox="0 0 20 20"
                    >
                      <path 
                        d="M18 9.5a1.5 1.5 0 01-1.5 1.5h-4.002l.76 3.295.024.246c0 .315-.126.61-.347.832L12 16.5l-6.375-6.375a1.5 1.5 0 01-.439-1.06V3.5a1.5 1.5 0 011.5-1.5h8.25a1.5 1.5 0 011.38.914l2.25 5.5A1.5 1.5 0 0118 9.5z"
                      />
                    </svg>
                    <span>Dislike</span>
                  </div>
                </button>
                {/* Share and Subscribe Buttons Container */}
                <div className="flex space-x-4">
                  {/* Share Button */}
                  <button
                    onClick={() => currentVideo && handleShare(currentVideo)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center space-x-2 w-24"
                  >
                    <svg 
                      className="w-5 h-5" 
                      fill="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"
                      />
                    </svg>
                    <span>Share</span>
                  </button>
                  {/* Subscribe Button */}
                  <button
                    onClick={handleSubscribe}
                    className={`px-4 py-2 ${
                      isSubscribed ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-600 hover:bg-blue-700'
                    } text-white rounded-xl transition-colors flex items-center space-x-2 w-32`}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="w-5 h-5" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>{isSubscribed ? 'Subscribed' : 'Subscribe'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 p-6 bg-gray-900 rounded-xl border border-gray-800">
              <div className="flex items-center justify-center space-x-3 text-gray-500">
                <svg 
                  className="w-6 h-6" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-sm font-poppins">
                  Scroll through the videos to leave a comment or like a video.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Row 3: Authentication and Profile Section */}
        <div className="flex-grow h-full w-full p-6 bg-black">
          <h2 className="text-2xl text-white font-bold mb-6">Account</h2>
          {user ? (
            <div className="space-y-6">
              {/* Logged-in User Actions */}
              <div className="flex space-x-4">
                <button
                  onClick={toggleProfileModal}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  <span>Profile</span>
                </button>

                <button
                  onClick={() => auth.signOut()}
                  className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                  </svg>
                  <span>Sign Out</span>
                </button>
              </div>

              {/* Profile Modal */}
              {isProfileModalOpen && <ProfileModal />}

              {/* Video Upload Section */}
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg text-white font-semibold mb-4">Upload Video</h3>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Enter video name"
                    value={videoName}
                    onChange={(e) => setVideoName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-xl placeholder-gray-500 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600"
                  />

                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-xl focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600"
                  >
                    <option value="">Select Category</option>
                    {VideoCategories.map((category) => (
                      <option key={category} value={category}>
                        {category.replace("-", " ")}
                      </option>
                    ))}
                  </select>

                  <label
                    htmlFor="video-upload"
                    className={`block w-full px-4 py-3 text-center rounded-xl cursor-pointer transition-colors ${
                      uploading 
                        ? "bg-gray-700 text-gray-400" 
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>{uploading ? "Uploading..." : "Upload Video"}</span>
                    </div>
                  </label>
                  <input
                    type="file"
                    id="video-upload"
                    accept="video/*"
                    className="hidden"
                    onChange={handleVideoUpload}
                    disabled={uploading || !selectedCategory}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h3 className="text-xl text-white font-semibold text-center mb-6">
                {isSignUp ? "Create an Account" : "Sign In"}
              </h3>
              
              <div className="space-y-4">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-xl placeholder-gray-500 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600"
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-xl placeholder-gray-500 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600"
                />

                {isSignUp && (
                  <>
                    <input
                      type="text"
                      placeholder="Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-xl placeholder-gray-500 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600"
                    />
                    <input
                      type="text"
                      placeholder="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-xl placeholder-gray-500 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600"
                    />
                    <input
                      type="date"
                      placeholder="Date of Birth"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-xl placeholder-gray-500 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600"
                    />
                    
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-gray-300">Select your interests:</p>
                      <div className="grid grid-cols-2 gap-3">
                        {VideoCategories.map((category) => (
                          <div key={category} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`signup-${category}`}
                              checked={selectedCategories.includes(category)}
                              onChange={() => {
                                setSelectedCategories(prev =>
                                  prev.includes(category)
                                    ? prev.filter(c => c !== category)
                                    : [...prev, category]
                                );
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-700 rounded focus:ring-blue-500 focus:ring-offset-gray-800"
                            />
                            <label htmlFor={`signup-${category}`} className="text-sm text-gray-300">
                              {category.replace("-", " ")}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <button
                  onClick={handleAuth}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                  {isSignUp ? "Sign Up" : "Sign In"}
                </button>

                <button
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="w-full text-blue-400 hover:text-blue-300 transition-colors text-sm"
                >
                  {isSignUp ? "Already have an account? Sign In" : "Need an account? Sign Up"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

