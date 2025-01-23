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
import { doc, setDoc, updateDoc, arrayUnion, getDoc, onSnapshot, collection, getDocs } from "firebase/firestore";
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
  const [videos, setVideos] = useState<{ url: string; name: string; uploaderName: string; uploaderId: string; comments: { username: string; text: string; timestamp: string }[] }[]>([]); // Retrieve user videos
  const [comment, setComment] = useState<string>(""); // Track the new comment
  const [currentVideo, setCurrentVideo] = useState<{ url: string; name: string; uploaderName: string; uploaderId: string; comments: { username: string; text: string; timestamp: string }[] } | null>(null); // Track the currently visible video

  const videoRefs = useRef<(HTMLDivElement | null)[]>([]); // Track the positions of the videos and determine which video is being seen

  const [userComments, setUserComments] = useState<{ videoName: string; content: string }[]>([]);
  const [userInfo, setUserInfo] = useState<any>(null);

    // The name of the video being uploaded
    const [videoName, setVideoName] = useState<string>(""); // Track user-defined video name


  useEffect(() => {
    if (user) {
      const fetchUserComments = async () => {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
  
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserInfo(data);
  
            // Extract comments
            const comments = data.comments || [];
            setUserComments(comments);
          }
        } catch (error) {
          console.error("Error fetching user comments:", error);
        }
      };
  
      fetchUserComments();
    }
  }, [user]);


  // State for modal visibility
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const toggleProfileModal = () => {
    setIsProfileModalOpen(!isProfileModalOpen);
  };





  


 
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
          // Update `currentVideo` when the video is fully visible in the viewport
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
  }, [videos, currentVideo]);
  

  
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
      const timestamp = new Date().toISOString();
      const commentDataForUser = {
        content: comment.trim(),
        videoName: currentVideo.name || "Unnamed Video",
        url: currentVideo.url,
        timestamp,
      };
  
      const commentDataForVideo = {
        username: user.displayName || name || user.email || "Anonymous",
        text: comment.trim(),
        timestamp,
      };
  
      // Update the user's profile (users collection)
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        comments: arrayUnion(commentDataForUser), // Add the new comment to the user's profile
      });
  
      // Update the video document in the videos collection
      const videosCollectionRef = collection(db, "videos");
      const querySnapshot = await getDocs(videosCollectionRef);
  
      let videoDocRef = null;
  
      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        if (data.url === currentVideo.url) {
          videoDocRef = doc(db, "videos", docSnapshot.id); // Get the reference to the matching document
        }
      });
  
      if (videoDocRef) {
        await updateDoc(videoDocRef, {
          comments: arrayUnion(commentDataForVideo), // Add the new comment to the video document
        });
        alert("Comment added successfully!");
      } else {
        console.error("No matching video found in the videos collection.");
        alert("Failed to update the video collection. Video not found.");
      }
  
      setComment(""); // Reset the comment field
    } catch (error) {
      console.error("Error adding comment:", error);
      alert("Failed to add comment. Please try again.");
    }
  };
  
  
  
  
  
      
  



  const fetchVideos = async () => {
    try {
      const videosCollectionRef = collection(db, "videos");
      const querySnapshot = await getDocs(videosCollectionRef);
  
      const allVideos = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          url: data.url,
          name: data.name || "Unnamed Video", // Ensure name is included
          uploaderName: data.uploaderName,
          uploaderId: data.uploaderId, // Add uploaderId here
          comments: data.comments || [],
        };
      });
      setVideos(allVideos);
    } catch (error) {
      console.error("Error fetching videos:", error);
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
  
    if (file.size > 100 * 1024 * 1024) {
      alert("File size exceeds 100 MB.");
      return;
    }
  
    setUploading(true);
    const storageRef = ref(storage, `videos/${selectedCategory}/${user.uid}/${file.name}`);
  
    try {
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
      const globalVideoDocRef = doc(db, "videos", `${user.uid}-${file.name}`);
      await setDoc(globalVideoDocRef, {
        url: downloadURL,
        name: videoName.trim(), // Save the user-defined name
        category: selectedCategory,
        timestamp: new Date().toISOString(),
        uploaderName: user.displayName || name || user.email || "Unnamed",
        comments: [],
  
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

  const getVideoDocRef = async (url: string) => {
    const videosCollectionRef = collection(db, "videos");
    const querySnapshot = await getDocs(videosCollectionRef);
  
    let videoDocRef = null;
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      if (data.url === url) {
        videoDocRef = doc(db, "videos", docSnapshot.id);
      }
    });
  
    return videoDocRef;
  };

  const updateCurrentVideoState = (updatedVideo: any) => {
    setCurrentVideo(updatedVideo);
  
    setVideos((prevVideos) =>
      prevVideos.map((video) =>
        video.url === updatedVideo.url ? updatedVideo : video
      )
    );
  };
  
  

  

 
     
 
  
  
  
  

  if (!isMounted) return null;

  const ProfileModal = () => {
    interface UserInfo {
      name?: string;
      username?: string;
      email?: string;
      dob?: string;
      interests?: string[];
      videos?: { name: string; likes?: string[] }[];
    }
    
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [likedVideos, setLikedVideos] = useState<string[]>([]);
  
    useEffect(() => {
      if (user) {
        const fetchUserInfo = async () => {
          try {
            const userDocRef = doc(db, "users", user.uid); // Replace "users" with your Firestore collection
            const userDoc = await getDoc(userDocRef);
  
            if (userDoc.exists()) {
              const data = userDoc.data();
              setUserInfo(data);
  
              // Extract liked videos
              const likedVideos = data.videos
                ?.filter((video: { likes?: string[] }) => video.likes?.includes(user.uid))
                ?.map((video: { name: string; likes?: string[] }) => video.name); // Assuming each video has a `name` field
              setLikedVideos(likedVideos || []);
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
  
          {/* 4 Columns */}
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
                  <p className="text-gray-600"><strong>Email:</strong> {user?.email || "N/A"}</p>
                  <p className="text-gray-600"><strong>Date of Birth:</strong> {userInfo.dob || "N/A"}</p>
                  <p className="text-gray-600"><strong>Interests:</strong> {userInfo.interests?.join(", ") || "N/A"}</p>
                </div>
              ) : (
                <p className="text-gray-600 mt-4">Loading user information...</p>
              )}
            </div>
  
            {/* Column 2: Liked Videos */}
            <div className="bg-gray-100 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-black">Liked Videos</h3>
              {likedVideos.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {likedVideos.map((videoName, index) => (
            <li key={index} className="text-black">
              {videoName || "Unnamed Video"} {/* Fallback for missing names */}
            </li>
              ))}
            </ul>
            ) : (
            <p className="text-black mt-4">No liked videos yet.</p>
            )}
            </div>
  
            {/* Column 3: User C */}
            <div className="bg-gray-100 p-4 rounded-lg">
          <h3 className="text-lg font-medium">Your Comments</h3>
          {userComments.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {userComments.map((comment, index) => (
                <li key={index} className="text-black">
                  <strong>{comment.videoName}</strong>: {comment.content}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-black mt-4">No comments yet.</p>
          )}
        </div>
  
            {/* Column 4 */}
            <div className="bg-gray-100 p-4 rounded-lg">
              <h3 className="text-lg font-medium">Column 4</h3>
              <p className="text-gray-600">Content for the fourth column goes here.</p>
            </div>
          </div>
  
          {/* Close Button */}
          <div className="flex justify-center">
            <button
              onClick={toggleProfileModal}
              className="mt-4 px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  
  
  




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
      {currentVideo.comments && currentVideo.comments.length > 0 ? (
        currentVideo.comments.map((comment, index) => (
          <div
            key={index}
            className="p-2 border border-gray-300 text-black rounded-md"
          >
            <p className="text-sm font-medium">
              {comment.username || "Anonymous"}
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
      <div className="mt-4 flex space-x-4">
      
      </div>

      <p className="mt-2 text-gray-500">
  
      </p>

      {/* Share Button */}
  <button
    onClick={() => {
      // Placeholder function for share button
      alert("Share functionality coming soon!");
    }}
    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
  >
    Share
  </button>
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
              onClick={toggleProfileModal}
              className="px-6 py-3 bg-blue-500 text-black rounded-lg text-lg"
             >

              Profile
            </button>

            {/* Render modal conditionally */}
            {isProfileModalOpen && <ProfileModal />}

            {/* Sign Out Button */}
            <button
              onClick={() => auth.signOut()}
              className="px-4 py-2 bg-red-500 text-black rounded-md"
            >
              Sign Out
            </button>
            {/* Input for video name */}
            <input
              type="text"
              placeholder="Enter video name"
              value={videoName}
              onChange={(e) => setVideoName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 text-black rounded-md"
  />

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
