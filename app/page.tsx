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
  getDocs 
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

  // Video Display and Interaction States
  const [videos, setVideos] = useState<{
    id: string,
    url: string;
    name: string;
    uploaderName: string;
    uploaderId: string;
    comments: { username: string; text: string; timestamp: string }[];
    likes: { username: string; timestamp: string }[];
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
  }

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
  const handleScroll = () => {
    if (!videoRefs.current) return;

    videoRefs.current.forEach((ref, index) => {
      if (ref) {
        const rect = ref.getBoundingClientRect();
        const videoElement = document.querySelector(`#video-${index}`) as HTMLVideoElement;
        
        // Check if video is fully visible in the viewport
        if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
          // Video is visible - play it and update states
          if (videoElement && videoElement.paused) {
            videoElement.play();
            setIsPlaying(prev => ({ ...prev, [index]: true }));
            setCurrentVideo({ ...videos[index], isPlaying: true });
          }
        } else {
          // Video is not visible - pause it
          if (videoElement && !videoElement.paused) {
            videoElement.pause();
            setIsPlaying(prev => ({ ...prev, [index]: false }));
          }
        }
      }
    });
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

  // Effect hook to fetch preferences when user logs in or updates them
  useEffect(() => {
    const fetchPreferences = async () => {
      if (user) {
        const preferences = await fetchUserPreferences(user.uid);
        setUserPreferences(preferences);
      }
    };

    fetchPreferences();
  }, [user]);

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
  const togglePlayPause = (index: number, isFullscreenVideo: boolean = false) => {
    const videoElement = isFullscreenVideo 
      ? document.querySelector(`#video-${index}-fullscreen`) as HTMLVideoElement
      : document.querySelector(`#video-${index}`) as HTMLVideoElement;
    
    if (!videoElement) return;

    // Pause all videos in the same view (fullscreen or normal)
    videos.forEach((_, idx) => {
      if (idx !== index) {
        const otherVideo = document.querySelector(
          isFullscreenVideo ? `#video-${idx}-fullscreen` : `#video-${idx}`
        ) as HTMLVideoElement;
        if (otherVideo) {
          otherVideo.pause();
          if (isFullscreenVideo) {
            setIsFullscreenPlaying(prev => ({ ...prev, [idx]: false }));
          } else {
            setIsPlaying(prev => ({ ...prev, [idx]: false }));
          }
        }
      }
    });

    // Toggle the clicked video
    if (videoElement.paused) {
      videoElement.play();
      if (isFullscreenVideo) {
        setIsFullscreenPlaying(prev => ({ ...prev, [index]: true }));
      } else {
        setIsPlaying(prev => ({ ...prev, [index]: true }));
      }
      setCurrentVideo({ ...videos[index], isPlaying: true });
    } else {
      videoElement.pause();
      if (isFullscreenVideo) {
        setIsFullscreenPlaying(prev => ({ ...prev, [index]: false }));
      } else {
        setIsPlaying(prev => ({ ...prev, [index]: false }));
      }
      setCurrentVideo({ ...videos[index], isPlaying: false });
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
        setUserInfo(data);
        setSelectedInterests(data.interests || []);
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
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

  // The code below manages user preferences that can be changed from the user's profile
  const handleInterestChange = (interest: string) => {
    setSelectedInterests((prevInterests) =>
      prevInterests.includes(interest)
        ? prevInterests.filter((i) => i !== interest)
        : [...prevInterests, interest]
    );
  };

  // Updates user preferences in Firestore and refreshes video recommendations
  const handleUpdatePreferences = async () => {
    if (!user) return;

    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        interests: selectedInterests
      });

      // Update local state for user preferences
      setUserPreferences(selectedInterests);

      // Fetch new recommended videos based on updated preferences
      const newRecommendedVideos = await recommendVideos(user.uid);
      setVideos(newRecommendedVideos);

      alert("Preferences updated successfully!");
      toggleProfileModal(); // Close the modal after updating
    } catch (error) {
      console.error("Error updating preferences:", error);
      alert("Failed to update preferences. Please try again.");
    }
  };

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

  // All the code that has to do with the profileModal
  // Displays user information, liked videos, comments, and uploaded videos
  const ProfileModal = () => {
    // Fetch user information when modal opens
    useEffect(() => {
      if (user) {
        const fetchUserInfo = async () => {
          try {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
              const data = userDoc.data();
              setUserInfo(data);
            }
          } catch (error) {
            console.error("Error fetching user info:", error);
          }
        };

        fetchUserInfo();
      }
    }, [user]);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div
          className="bg-white p-8 rounded-lg shadow-lg"
          style={{
            width: "100%",
            height: "100%",
            maxWidth: "2000px",
            maxHeight: "90%",
          }}
        >
          <h2 className="text-2xl font-semibold mb-4">Profile</h2>

          {/* 4 Columns Grid Layout */}
          <div
            className="grid grid-cols-4 gap-4"
            style={{
              height: "calc(100% - 100px)",
            }}
          >
            {/* Column 1: User Information */}
            <div className="bg-gray-100 p-4 rounded-lg">
              <h3 className="text-lg font-medium">User Information</h3>
              {userInfo ? (
                <div className="mt-4">
                  <p className="text-gray-600"><strong>Name:</strong> {userInfo.name || "N/A"}</p>
                  <p className="text-gray-600"><strong>Username:</strong> {userInfo.username || "N/A"}</p>
                  <p className="text-gray-600"><strong>Email:</strong> {user ? user.email : "N/A"}</p>
                  <p className="text-gray-600"><strong>Date of Birth:</strong> {userInfo.dob || "N/A"}</p>
                  <div className="text-gray-600">
                    <strong>Interests:</strong>
                    <div className="mt-2">
                      {VideoCategories.map((interest) => (
                        <div key={interest} className="flex items-center">
                          <input
                            type="checkbox"
                            id={interest}
                            checked={selectedInterests.includes(interest)}
                            onChange={() => handleInterestChange(interest)}
                            className="mr-2"
                          />
                          <label htmlFor={interest}>{interest}</label>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleUpdatePreferences}
                      className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                      Update Preferences
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-600 mt-4">Loading user information...</p>
              )}
            </div>

            {/* Column 2: Liked Videos */}
            <div className="bg-gray-100 p-4 rounded-lg flex flex-col h-full">
              <h3 className="text-lg font-medium">Liked Videos</h3>
              <button className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                Access Your Liked Videos
              </button>
              {likedVideos.length > 0 ? (
                <div className="mt-4 space-y-2 flex-grow overflow-y-auto">
                  {likedVideos.map((video, index) => (
                    <div key={index} className="p-2 border border-gray-300 text-black rounded-md">
                      <p className="text-sm font-medium">{video.videoName}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 mt-4">You haven't liked any videos yet.</p>
              )}
            </div>

            {/* Column 3: User Comments */}
            <div className="bg-gray-100 p-4 rounded-lg flex flex-col h-full">
              <h3 className="text-lg font-medium mb-4">Your Comments</h3>
              {userComments.length > 0 ? (
                <div className="flex-grow overflow-y-auto space-y-2">
                  {userComments.map((comment, index) => (
                    <div key={index} className="p-2 border border-gray-300 text-black rounded-md">
                      <p className="text-sm font-medium">
                        <strong>Video:</strong> {comment.videoName}
                      </p>
                      <p><strong>Comment:</strong> {comment.content}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(comment.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">You have not commented on any videos yet.</p>
              )}
            </div>

            {/* Column 4: Uploaded Videos */}
            <div className="bg-gray-100 p-4 rounded-lg flex flex-col h-full">
              <h3 className="text-lg font-medium">Your Uploaded Videos</h3>
              <button className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                Access Your Uploaded Videos
              </button>
              {userVideos.length > 0 ? (
                <div className="mt-4 space-y-2 flex-grow overflow-y-auto">
                  {userVideos.map((video, index) => (
                    <div key={index} className="p-2 border border-gray-300 text-black rounded-md">
                      <p className="text-sm font-medium">
                        <strong>Video:</strong> {video.name || "Unnamed Video"}
                      </p>
                      <p className="text-xs text-gray-500">
                        Category: {video.category}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 mt-4">You have not uploaded any videos yet.</p>
              )}
            </div>
          </div>

          {/* Close Button */}
          <div className="flex justify-center">
            <button
              onClick={toggleProfileModal}
              className={styles.closeButton}
            >
              Exit Focus
            </button>
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
                <p className="text-base opacity-80">@{video.uploaderName}</p>
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
              Exit Focus
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
                      <p className="text-base opacity-80">@{video.uploaderName}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Right Column - Comments, Interactions, and Auth */}
      <div className="w-1/2 bg-white p-8 flex flex-col items-center space-y-4 h-full border-l border-black">
        {/* Row 1: Comments Display */}
        <div className="flex-grow h-full w-full border-b border-black p-4 overflow-y-auto">
          <h2 className="text-lg text-black font-semibold">Comments</h2>
          {currentVideo ? (
            <div className="mt-4 space-y-2">
              {/* Video Information */}
              <div className="bg-gray-100 p-4 rounded-lg">
                <p className="text-lg text-black font-semibold">{currentVideo.name}</p>
                <p className="text-sm text-black">Uploaded by: {currentVideo.uploaderName}</p>
              </div>
              {/* Comments List */}
              {currentVideo.comments && currentVideo.comments.length > 0 ? (
                currentVideo.comments.map((comment, index) => (
                  <div
                    key={index}
                    className="p-2 border border-gray-300 text-black rounded-md"
                  >
                    <p className="text-sm font-medium">{comment.username || "Anonymous"}</p>
                    <p>{comment.text}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(comment.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No comments yet. Be the first to comment!</p>
              )}
            </div>
          ) : (
            <p className="text-gray-500 mt-4">Scroll through the videos to see comments.</p>
          )}
        </div>

        {/* Row 2: Add Comment Section */}
        <div className="flex-grow h-full w-full border-b border-black p-4">
          <h2 className="text-lg text-black font-semibold">Add a Comment</h2>
          {currentVideo ? (
            <div className="mt-4">
              {/* Comment Input */}
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write your comment..."
                className="w-full px-4 py-2 border border-gray-300 text-black rounded-md"
                rows={3}
              ></textarea>
              {/* Action Buttons */}
              <button
                onClick={handleAddComment}
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md"
              >
                Add Comment
              </button>
              <div className="mt-4 flex space-x-4">
                {/* Like Button */}
                <button
                  onClick={handleLike}
                  className={`px-4 py-2 text-white rounded-md hover:bg-opacity-80 ${
                    currentVideo?.likes?.some((like) => 
                      like.username === (user?.displayName || user?.email)
                    )
                      ? "bg-red-500"
                      : "bg-blue-500"
                  }`}
                >
                  Like
                </button>
                {/* Share Button */}
                <button
                  onClick={() => currentVideo && handleShare(currentVideo)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Share
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 mt-4">
              Scroll through the videos to leave a comment or like a video.
            </p>
          )}
        </div>

        {/* Row 3: Authentication and Profile Section */}
        <div className="flex-grow h-full">
          {user ? (
            <>
              {/* Logged-in User Actions */}
              <button
                onClick={toggleProfileModal}
                className="px-6 py-3 bg-blue-500 text-black rounded-lg text-lg"
              >
                Profile
              </button>

              {/* Profile Modal */}
              {isProfileModalOpen && <ProfileModal />}

              {/* Sign Out Button */}
              <button
                onClick={() => auth.signOut()}
                className="px-4 py-2 bg-red-500 text-black rounded-md"
              >
                Sign Out
              </button>

              {/* Video Upload Section */}
              <input
                type="text"
                placeholder="Enter video name"
                value={videoName}
                onChange={(e) => setVideoName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 text-black rounded-md"
              />

              {/* Category Selection */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="mt-4 px-4 py-2 border text-black border-gray-300 rounded-md"
              >
                <option value="">Select Category</option>
                {VideoCategories.map((category) => (
                  <option key={category} value={category}>
                    {category.replace("-", " ")}
                  </option>
                ))}
              </select>

              {/* Upload Button */}
              <label
                htmlFor="video-upload"
                className={`mt-4 px-4 py-2 ${
                  uploading ? "bg-gray-500" : "bg-green-500"
                } text-white rounded-md cursor-pointer hover:bg-green-600`}
              >
                {uploading ? "Uploading..." : "Upload Video"}
              </label>
              <input
                type="file"
                id="video-upload"
                accept="video/*"
                className="hidden"
                onChange={handleVideoUpload}
                disabled={uploading || !selectedCategory}
              />
            </>
          ) : (
            // Authentication Forms for Non-logged-in Users
            <div className="space-y-4">
              <h1 className="text-xl font-semibold text-center mb-4">
                {isSignUp ? "Create an Account" : "Sign In"}
              </h1>
              
              {/* Email Input */}
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md text-black"
              />

              {/* Password Input */}
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md text-black"
              />

              {/* Additional Sign Up Fields */}
              {isSignUp && (
                <>
                  <input
                    type="text"
                    placeholder="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md text-black"
                  />
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md text-black"
                  />
                  <input
                    type="date"
                    placeholder="Date of Birth"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md text-black"
                  />
                  
                  {/* Category Selection */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-black">Select your interests:</p>
                    {VideoCategories.map((category) => (
                      <div key={category} className="flex items-center">
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
                          className="mr-2"
                        />
                        <label htmlFor={`signup-${category}`} className="text-sm text-black">
                          {category.replace("-", " ")}
                        </label>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Auth Button */}
              <button
                onClick={handleAuth}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                {isSignUp ? "Sign Up" : "Sign In"}
              </button>

              {/* Toggle Sign Up/Sign In */}
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="w-full text-blue-500 hover:text-blue-600"
              >
                {isSignUp ? "Already have an account? Sign In" : "Need an account? Sign Up"}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}


