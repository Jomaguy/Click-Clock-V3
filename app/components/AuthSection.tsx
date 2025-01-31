"use client";

import { useState, useEffect } from "react";
import { User, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

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

interface AuthSectionProps {
  onAuthStateChange?: (user: User | null) => void;
}

export default function AuthSection({ onAuthStateChange }: AuthSectionProps) {
  const [user, setUser] = useState<User | null>(null);
  // Authentication States
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [dob, setDob] = useState<string>("");
  const [isSignUp, setIsSignUp] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string>("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      onAuthStateChange?.(user);
    });
    return () => unsubscribe();
  }, [onAuthStateChange]);

  // Handle user registration
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate category selection
    if (selectedCategories.length === 0) {
      setAuthError("Please select at least one category of interest.");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Create user profile in Firestore
      await setDoc(doc(db, "users", user.uid), {
        name,
        username,
        dob,
        email,
        createdAt: new Date().toISOString(),
        preferences: selectedCategories,
        followers: [],
        following: []
      });

      setUser(user);
      setAuthError("");
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  // Handle user login
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setUser(userCredential.user);
      setAuthError("");
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">
        {isSignUp ? "Create Account" : "Sign In"}
      </h2>
      
      <form onSubmit={isSignUp ? handleSignUp : handleSignIn}>
        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded text-black"
            required
          />
          
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded text-black"
            required
          />

          {isSignUp && (
            <>
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border rounded text-black"
                required
              />
              
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-2 border rounded text-black"
                required
              />
              
              <input
                type="date"
                placeholder="Date of Birth"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full p-2 border rounded text-black"
                required
              />

              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">Select your interests:</p>
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
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor={`signup-${category}`} className="text-sm text-gray-700">
                        {category.replace("-", " ")}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {authError && (
            <p className="text-red-500 text-sm">{authError}</p>
          )}

          <button
            type="submit"
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
          >
            {isSignUp ? "Sign Up" : "Sign In"}
          </button>
        </div>
      </form>

      <p className="mt-4 text-center">
        {isSignUp ? "Already have an account? " : "Don't have an account? "}
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-blue-500 hover:underline"
        >
          {isSignUp ? "Sign In" : "Sign Up"}
        </button>
      </p>
    </div>
  );
} 