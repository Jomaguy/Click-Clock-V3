"use client";

import { useState, useEffect } from "react";
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
import { doc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
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
  const [selectedCategory, setSelectedCategory] = useState<string>(""); // Track selected category

  // Monitor authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user || null);
    });

    setIsMounted(true);

    return () => unsubscribe();
  }, []);

  // Handle user sign-up or sign-in
  const handleAuth = async () => {
    try {
      if (isSignUp) {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        const userDoc = doc(db, "users", user.uid);
        await setDoc(userDoc, {
          name,
          username,
          email,
          dob,
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

  if (!isMounted) return null;

  return (
    <main className="flex h-screen">
      {/* Left Column */}
      <div className="w-1/2 bg-gray-100 p-4">
        {/* Empty content for now */}
      </div>

      {/* Right Column - Authentication and Upload */}
      <div className="w-1/2 bg-white p-8 flex flex-col items-center space-y-4">
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
              className="px-4 py-2 bg-red-500 text-white rounded-md"
            >
              Sign Out
            </button>

            {/* Category Selector */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="mt-4 px-4 py-2 border border-gray-300 rounded-md"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                />
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                />
                <input
                  type="date"
                  placeholder="Date of Birth"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                />
              </>
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
            <button
              onClick={handleAuth}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-md"
            >
              {isSignUp ? "Sign Up" : "Sign In"}
            </button>
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="w-full px-4 py-2 bg-gray-200 rounded-md"
            >
              Switch to {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
