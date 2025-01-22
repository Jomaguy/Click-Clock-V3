"use client";

import { useState, useEffect, useRef } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { doc, setDoc, updateDoc, arrayUnion, getDoc, onSnapshot } from "firebase/firestore";
import { auth, storage, db } from "./lib/firebase";

// Define video categories (lowercase with hyphens to match rules)
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

export default function App() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [dob, setDob] = useState<string>("");
  const [isSignUp, setIsSignUp] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(""); // Track selected category for video upload
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]); // Track Selected categories for user preferences
  const [videos, setVideos] = useState<{ url: string; uploaderName: string; comments: { username: string; text: string; timestamp: string }[]; likes: string[]; unlikes: string[] }[]>([]); // Retrieve user videos
  const [comment, setComment] = useState<string>(""); // Track the new comment
  const [currentVideo, setCurrentVideo] = useState<{ url: string; uploaderName: string; comments: { username: string; text: string; timestamp: string }[]; likes: string[]; unlikes: string[] } | null>(null); // Track the currently visible video

  const videoRefs = useRef<(HTMLDivElement | null)[]>([]); // Track the positions of the videos and determine which video is being seen






 
  // Monitor authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user || null);
    });

    setIsMounted(true);

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    console.log("Current Video:", currentVideo); // Debug log for currentVideo
  }, [currentVideo]);


  const handleScroll = () => {
    if (!videoRefs.current) return;
  
    videoRefs.current.forEach((ref, index) => {
      if (ref) {
        const rect = ref.getBoundingClientRect();
        if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
          // Directly set `currentVideo` without waiting for updates from Firestore
          const visibleVideo = videos[index];
          if (visibleVideo && (!currentVideo || visibleVideo.url !== currentVideo.url)) {
            setCurrentVideo(visibleVideo);
          }
        }
      }
    });
  };
  

  useEffect(() => {
    const leftColumn = document.querySelector(".left-column");
    if (leftColumn) {
      leftColumn.addEventListener("scroll", handleScroll);
    }
  
    return () => {
      if (leftColumn) {
        leftColumn.removeEventListener("scroll", handleScroll);
      }
    };
  }, [videos]);

  
  useEffect(() => {
    if (!user) return;
  
    const userDocRef = doc(db, "users", user.uid);
  
    const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const userVideos = docSnapshot.data().videos || [];
        setVideos(userVideos); // Only update `videos` state
      }
    });
  
    return () => unsubscribe();
  }, [user]);
  
  
  
  
  




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
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
  
      if (userDoc.exists()) {
        const userVideos = userDoc.data().videos || [];
        const updatedVideos = userVideos.map((video: any) => {
          if (video.url === currentVideo.url) {
            return {
              ...video,
              comments: [
                ...(video.comments || []),
                {
                  userId: user.uid,
                  username: user.displayName || name || user.email || "Anonymous",
                  text: comment,
                  timestamp: new Date().toISOString(),
                },
              ],
            };
          }
          return video;
        });
  
        await updateDoc(userDocRef, { videos: updatedVideos });

        alert("Comment added successfully!");
        setComment("");
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      alert("Failed to add comment. Please try again.");
    }
  };
  
      
  



  const fetchVideos = async () => {
    if (!user) return;

    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userVideos = userDoc.data().videos || [];
      setVideos(userVideos);
    }
  };

  useEffect(() => {
    if (user) {
      fetchVideos();
    }
  }, [user]);

  // Handle user sign-up or sign-in
  const handleAuth = async () => {
    try {
      if (isSignUp) {
        if (selectedCategories.length === 0) {
          alert("Please select at least one category.");
          return;
        }
  
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        const userDoc = doc(db, "users", user.uid);
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
        await signInWithEmailAndPassword(auth, email, password);
        alert("Sign-in successful!");
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "An unknown error occurred");
    }
  };

  
  

  // Handle video upload
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

    // Validate file size (100 MB max)
    if (file.size > 100 * 1024 * 1024) {
      alert("File size exceeds 100 MB.");
      return;
    }

    setUploading(true);
    const storageRef = ref(storage, `videos/${selectedCategory}/${user.uid}/${file.name}`);

    try {
      // Upload video to Firebase Storage
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Save video reference to Firestore
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        videos: arrayUnion({
          url: downloadURL,
          category: selectedCategory,
          timestamp: new Date().toISOString(),
          uploaderName: user.displayName || name || user.email || "Quien", // Save uploader's name
          comments: [],
          likes: [],
          unlikes: [],
        }),
      });

      alert("Video uploaded successfully!");
      setSelectedCategory(""); // Reset category
    } catch (error) {
      console.error("Error uploading video:", error);
      alert("Failed to upload video. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleLike = async () => {
    if (!user) {
      alert("You must be logged in to like a video.");
      return;
    }
  
    if (!currentVideo) {
      alert("No video is currently visible.");
      return;
    }
  
    try {
      console.log("Liking video:", currentVideo.url);
  
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
  
      if (userDoc.exists()) {
        const userVideos = userDoc.data().videos || [];
        const updatedVideos = userVideos.map((video: any) => {
          if (video.url === currentVideo.url) {
            const alreadyLiked = video.likes?.includes(user.uid);
            return {
              ...video,
              likes: alreadyLiked
                ? video.likes // No change if already liked
                : [...(video.likes || []), user.uid], // Add user to likes
              unlikes: video.unlikes?.filter((uid: string) => uid !== user.uid) || [], // Ensure no undefined
            };
          }
          return video;
        });
  
        // Validate updatedVideos
        console.log("Updated Videos:", updatedVideos);
  
        await updateDoc(userDocRef, { videos: updatedVideos });
  
        const updatedCurrentVideo = updatedVideos.find(
          (video: any) => video.url === currentVideo.url
        );
        setCurrentVideo(updatedCurrentVideo || null);
      }
    } catch (error) {
      console.error("Error liking video:", error);
      alert("Failed to like the video. Please try again.");
    }
  };
  
  
  
  const handleUnlike = async () => {
    if (!user) {
      alert("You must be logged in to unlike a video.");
      return;
    }
  
    if (!currentVideo) {
      alert("No video is currently visible.");
      return;
    }
  
    try {
      console.log("Unliking video:", currentVideo.url);
  
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
  
      if (userDoc.exists()) {
        const userVideos = userDoc.data().videos || [];
        const updatedVideos = userVideos.map((video: any) => {
          if (video.url === currentVideo.url) {
            const alreadyUnliked = video.unlikes?.includes(user.uid);
            return {
              ...video,
              unlikes: alreadyUnliked
                ? video.unlikes // No change if already unliked
                : [...(video.unlikes || []), user.uid], // Add user to unlikes
              likes: video.likes?.filter((uid: string) => uid !== user.uid) || [], // Ensure no undefined
            };
          }
          return video;
        });
  
        // Validate updatedVideos
        console.log("Updated Videos:", updatedVideos);
  
        await updateDoc(userDocRef, { videos: updatedVideos });
  
        const updatedCurrentVideo = updatedVideos.find(
          (video: any) => video.url === currentVideo.url
        );
        setCurrentVideo(updatedCurrentVideo || null);
      }
    } catch (error) {
      console.error("Error unliking video:", error);
      alert("Failed to unlike the video. Please try again.");
    }
  };
  
  
  

  
  
  

  if (!isMounted) return null;

  return (
    <main className="flex h-screen">
      {/* Left Column */}
      <div className="w-1/2 bg-black overflow-y-scroll snap-y snap-mandatory h-screen left-column">
  {videos.map((video, index) => (
    <div
      key={index}
      ref={(el) => {
        videoRefs.current[index] = el; // Assign the ref
      }}
      className="h-screen snap-start flex justify-center items-center"
    >
      <div className="w-full h-full bg-black flex justify-center items-center">
        <video
          src={video.url}
          controls
          className="w-auto h-full object-contain"
        />
      </div>
    </div>
  ))}
</div>




      {/* Right Column - Authentication and Upload */}
<div className="w-1/2 bg-white p-8 flex flex-col items-center space-y-4 h-full border-l border-black">
  {/* Authentication and Upload Logic */}
  
  {/* Row 1: Display Comments */}
<div className="flex-grow h-full w-full border-b border-black p-4 overflow-y-auto">
  <h2 className="text-lg font-semibold">Comments</h2>
  {currentVideo ? (
    <div className="mt-4 space-y-2">
      {currentVideo.comments?.length > 0 ? (
        currentVideo.comments.map((comment, index) => (
          <div
            key={index}
            className="p-2 border border-gray-300 text-black rounded-md"
          >
            <p className="text-sm font-medium">
              {comment.username || currentVideo.uploaderName || "Anonymous"}
            </p>
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
  <h2 className="text-lg font-semibold">Add a Comment</h2>
  {/* Add Comment Form */}
  {currentVideo ? (
    <div className="mt-4">
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Write your comment..."
        className="w-full px-4 py-2 border border-gray-300  text-black rounded-md"
        rows={3}
      ></textarea>
      <button
        onClick={handleAddComment}
        className="mt-2 px-4 py-2 bg-blue-500 text-black rounded-md"
      >
        Add Comment
      </button>
      {/* Like/Unlike Buttons */}
      <div className="mt-4 flex space-x-4">
        <button
          onClick={handleLike}
          className={`px-4 py-2 rounded-md ${
            user?.uid && currentVideo?.likes?.includes(user.uid) ? "bg-green-500" : "bg-gray-300"
          } text-white`}
        >
          Like
        </button>
        <button
          onClick={handleUnlike}
          className={`px-4 py-2 rounded-md ${
            user?.uid && currentVideo?.unlikes?.includes(user.uid) ? "bg-red-500" : "bg-gray-300"
          } text-white`}
        >
          Unlike
        </button>
      </div>

      {/* Like/Unlike Count */}
      <p className="mt-2 text-gray-500">
        {currentVideo?.likes?.length || 0} {currentVideo?.likes?.length === 1 ? "like" : "likes"} |{" "}
        {currentVideo?.unlikes?.length || 0} {currentVideo?.unlikes?.length === 1 ? "unlike" : "unlikes"}
      </p>
    </div>
  ) : (
    <p className="text-gray-500 mt-4">Scroll through the videos to leave a comment or like a video.</p>
  )}
</div>






      {/* Row 3 */}
      <div className="flex-grow h-full">
      {user ? (
          <>
            {/* Profile Button */}
            <button
              onClick={() => alert("Profile functionality not implemented yet.")}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg text-lg"
            >
              Profile
            </button>

            {/* Sign Out Button */}
            <button
              onClick={() => auth.signOut()}
              className="px-4 py-2 bg-red-500 text-black rounded-md"
            >
              Sign Out
            </button>

            {/* Category Selector */}
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

            {/* Upload Video */}
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
          <div className="space-y-4">
            <h1 className="text-xl font-semibold text-center">
              {isSignUp ? "Sign Up" : "Sign In"}
            </h1>
            {isSignUp && (
              <>
                <input
                  type="text"
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border text-black border-gray-300 rounded-md"
              />
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2 border text-black border-gray-300 rounded-md"
                />
                <input
                  type="date"
                  placeholder="Date of Birth"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-4 py-2 border text-black border-gray-300 rounded-md"
                />
                <h3 className="text-lg font-medium mt-4">Select Your Interests:</h3>
                <div className="grid grid-cols-2 gap-2">
                  {VideoCategories.map((category) => (
                    <label key={category} className="flex items-center text-black space-x-2">
                      <input
                        type="checkbox"
                        value={category}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCategories((prev) => [...prev, category]);
                          } else {
                            setSelectedCategories((prev) =>
                              prev.filter((c) => c !== category)
                            );
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span>{category.replace("-", " ")}</span>
                    </label>
                  ))}
                </div>
              </>
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border text-black border-gray-300 rounded-md"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border text-black border-gray-300 rounded-md"
            />
            <button
              onClick={handleAuth}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-md"
            >
              {isSignUp ? "Sign Up" : "Sign In"}
            </button>
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="w-full px-4 py-2 bg-gray-200  text-black rounded-md"
            >
              Switch to {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </div>
        )}
      </div>
      

        
      </div>


    </main>
  );
}
