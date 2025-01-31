"use client";

import { useState } from 'react';
import { User } from 'firebase/auth';
import { doc, updateDoc, arrayUnion, getDoc, collection, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../lib/firebase';
import AuthSection from './AuthSection';
import { VideoType } from '../types/types';

// Available video categories
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

interface RightColumnProps {
  user: User | null;
  currentVideo: VideoType | null;
  onUpdateVideoLikesAction: (videoId: string, userId: string, username: string, isAdding: boolean) => Promise<void>;
  onUpdateVideoDislikesAction: (videoId: string, userId: string, username: string, isAdding: boolean) => Promise<void>;
  onUpdateVideoCommentsAction: (videoId: string, username: string, text: string) => Promise<void>;
  onLoadMoreVideosAction: () => Promise<void>;
  onSetUserAction: (user: User | null) => void;
  onOpenProfileAction: () => void;
}

export default function RightColumn({
  user,
  currentVideo,
  onUpdateVideoLikesAction,
  onUpdateVideoDislikesAction,
  onUpdateVideoCommentsAction,
  onLoadMoreVideosAction,
  onSetUserAction,
  onOpenProfileAction,
}: RightColumnProps) {
  // State for comments
  const [comment, setComment] = useState("");
  
  // State for video upload
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [videoName, setVideoName] = useState("");

  // Function to handle liking/unliking videos
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
      const userDoc = await getDoc(userDocRef);

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

      if (alreadyLiked) {
        // Unlike: Remove the like data from user profile
        await updateDoc(userDocRef, {
          likes: arrayUnion(...userLikes.filter((like: { url: string }) => like.url === currentVideo.url))
        });

        await onUpdateVideoLikesAction(
          currentVideo.id,
          user.uid,
          user.displayName || user.email || "Anonymous",
          false
        );

        alert("Video unliked successfully!");
      } else {
        // Like: Add the like data to user profile
        await updateDoc(userDocRef, {
          likes: arrayUnion(userLikeData),
        });

        await onUpdateVideoLikesAction(
          currentVideo.id,
          user.uid,
          user.displayName || user.email || "Anonymous",
          true
        );

        alert("Video liked successfully!");
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      alert("Failed to update like status. Please try again.");
    }
  };

  // Function to handle disliking videos
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
      const userDoc = await getDoc(userDocRef);

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

      if (alreadyDisliked) {
        // Remove dislike
        await updateDoc(userDocRef, {
          dislikes: arrayUnion(...userDislikes.filter((dislike: { url: string }) => dislike.url === currentVideo.url))
        });

        await onUpdateVideoDislikesAction(
          currentVideo.id,
          user.uid,
          user.displayName || user.email || "Anonymous",
          false
        );

        alert("Video dislike removed successfully!");
      } else {
        // Add dislike
        await updateDoc(userDocRef, {
          dislikes: arrayUnion(userDislikeData),
        });

        await onUpdateVideoDislikesAction(
          currentVideo.id,
          user.uid,
          user.displayName || user.email || "Anonymous",
          true
        );

        alert("Video disliked successfully!");
      }
    } catch (error) {
      console.error("Error toggling dislike:", error);
      alert("Failed to update dislike status. Please try again.");
    }
  };

  // Function to handle video sharing
  const handleShare = async (video: VideoType) => {
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

  // Function to handle adding comments
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

      // Update user's document with new comment
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        comments: arrayUnion(commentDataForUser),
      });

      // Update video with new comment
      await onUpdateVideoCommentsAction(
        currentVideo.id,
        user.displayName || user.email || "Anonymous",
        comment.trim()
      );

      setComment(""); // Reset the comment input field
      alert("Comment added successfully!");
    } catch (error) {
      console.error("Error adding comment:", error);
      alert("Failed to add comment. Please try again.");
    }
  };

  // Function to handle video upload
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
          name: videoName.trim(),
          category: selectedCategory,
          timestamp: new Date().toISOString(),
        }),
      });

      // Save video to global collection
      const videoDocRef = doc(collection(db, "videos"));
      await setDoc(videoDocRef, {
        url: downloadURL,
        name: videoName.trim(),
        category: selectedCategory,
        timestamp: new Date().toISOString(),
        uploaderName: user.displayName || user.email || "Unnamed",
        uploaderId: user.uid,
        comments: [],
        likes: [],
        dislikes: [],
      });
  
      alert("Video uploaded successfully!");
      setSelectedCategory("");
      setVideoName("");
      // Reload videos after upload
      await onLoadMoreVideosAction();
    } catch (error) {
      console.error("Error uploading video:", error);
      alert("Failed to upload video. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {!user ? (
        <AuthSection onAuthStateChange={onSetUserAction} />
      ) : (
        <>
          {/* Comments Display Section */}
          <div className="bg-gray-900 rounded-xl p-6">
            <h3 className="text-lg text-white font-semibold mb-4">Comments</h3>
            {currentVideo?.comments && currentVideo.comments.length > 0 ? (
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {currentVideo.comments.map((comment, index) => (
                  <div key={index} className="bg-gray-800 p-4 rounded-lg">
                    <p className="text-white font-semibold">{comment.username}</p>
                    <p className="text-gray-300">{comment.text}</p>
                    <p className="text-sm text-gray-400">
                      {new Date(comment.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">No comments yet</p>
            )}
          </div>

          {/* Add Comment Section */}
          <div className="bg-gray-900 rounded-xl p-6">
            <div className="space-y-4">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment..."
                className="w-full p-2 bg-gray-800 text-white rounded resize-none"
                rows={3}
              />
              <button
                onClick={handleAddComment}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                disabled={!currentVideo}
              >
                Comment
              </button>
            </div>
          </div>

          {/* Video Information */}
          {currentVideo && (
            <div className="bg-gray-900 rounded-xl p-6">
              <h3 className="text-lg text-white font-semibold mb-2">{currentVideo.name}</h3>
              <p className="text-gray-300 mb-4">Uploaded by: {currentVideo.uploaderName}</p>
              <div className="flex space-x-4">
                <button
                  onClick={handleLike}
                  className={`px-4 py-2 rounded ${
                    currentVideo?.likes?.some(like => like.username === (user?.displayName || user?.email))
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  } text-white`}
                >
                  Like ({currentVideo?.likes?.length || 0})
                </button>
                
                <button
                  onClick={handleDislike}
                  className={`px-4 py-2 rounded ${
                    currentVideo?.dislikes?.some(dislike => dislike.username === (user?.displayName || user?.email))
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  } text-white`}
                >
                  Dislike ({currentVideo?.dislikes?.length || 0})
                </button>
                
                <button
                  onClick={() => handleShare(currentVideo)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Share
                </button>
              </div>
            </div>
          )}

          {/* User profile and interaction section */}
          <div className="flex space-x-4">
            <button
              onClick={onOpenProfileAction}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              Profile
            </button>
            <button
              onClick={() => auth.signOut()}
              className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
          
          {/* Video upload section */}
          <div className="bg-gray-900 rounded-xl p-6">
            <h3 className="text-lg text-white font-semibold mb-4">Upload Video</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Video name"
                value={videoName}
                onChange={(e) => setVideoName(e.target.value)}
                className="w-full p-2 bg-gray-800 text-white rounded"
              />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-2 bg-gray-800 text-white rounded"
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
                {uploading ? "Uploading..." : "Upload Video"}
              </label>
              <input
                type="file"
                id="video-upload"
                accept="video/*"
                className="hidden"
                onChange={handleVideoUpload}
                disabled={uploading || !selectedCategory || !videoName.trim()}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
} 