"use client";

import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ProfileModalProps {
  user: User | null;
  onCloseAction: () => void;
}

interface UserInfo {
  name?: string;
  username?: string;
  email?: string;
  dob?: string;
  interests?: string[];
  videos?: { name: string; likes?: string[] }[];
  subscriptions: string[];
}

export default function ProfileModal({ 
  user, 
  onCloseAction
}: ProfileModalProps) {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [likedVideos, setLikedVideos] = useState<{ videoName: string; }[]>([]);
  const [userComments, setUserComments] = useState<{ videoName: string; content: string; timestamp: string; }[]>([]);
  const [userVideos, setUserVideos] = useState<{ name: string; category: string; }[]>([]);

  // Function to fetch user information
  const fetchUserInfo = async () => {
    if (!user) return;
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserInfo({
          ...data,
          subscriptions: data.subscriptions || []
        });
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  };

  // Function to fetch liked videos
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
    if (!user) return;
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
    if (!user) return;
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

  // Fetch all user data when modal opens
  useEffect(() => {
    if (user) {
      const fetchAllData = async () => {
        try {
          await Promise.all([
            fetchUserInfo(),
            fetchLikedVideos(),
            fetchUserComments(),
            fetchUserVideos()
          ]);
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      };

      fetchAllData();
    }
  }, [user]);

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
          onClick={onCloseAction}
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

        {/* Grid Layout */}
        <div
          className="grid grid-cols-4 gap-4"
          style={{
            height: "calc(100% - 100px)",
          }}
        >
          {/* User Information */}
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

          {/* Liked Videos */}
          <div className="bg-gray-900 p-4 rounded-xl border border-white">
            <h3 className="text-lg font-medium text-white mb-4">Liked Videos</h3>
            <div className="mt-4 space-y-2 max-h-[600px] overflow-y-auto">
              {likedVideos.length > 0 ? (
                likedVideos.map((video, index) => (
                  <div 
                    key={index} 
                    className="p-4 bg-gray-800 border border-gray-700 rounded-xl hover:border-gray-600 transition-colors"
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
                      <p className="text-sm font-medium text-white truncate">
                        {video.videoName}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-white opacity-60">No liked videos yet</p>
              )}
            </div>
          </div>

          {/* User Comments */}
          <div className="bg-gray-900 p-4 rounded-xl border border-white">
            <h3 className="text-lg font-medium text-white mb-4">Your Comments</h3>
            <div className="mt-4 space-y-2 max-h-[600px] overflow-y-auto">
              {userComments.length > 0 ? (
                userComments.map((comment, index) => (
                  <div 
                    key={index} 
                    className="p-4 bg-gray-800 border border-gray-700 rounded-xl hover:border-gray-600 transition-colors"
                  >
                    <div className="flex flex-col space-y-2">
                      <p className="text-sm font-semibold text-white">
                        {comment.videoName}
                      </p>
                      <p className="text-white text-sm">
                        {comment.content}
                      </p>
                      <p className="text-xs text-white opacity-60">
                        {new Date(comment.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-white opacity-60">No comments yet</p>
              )}
            </div>
          </div>

          {/* Uploaded Videos */}
          <div className="bg-gray-900 p-4 rounded-xl border border-white">
            <h3 className="text-lg font-medium text-white mb-4">Your Uploaded Videos</h3>
            <div className="mt-4 space-y-2 max-h-[600px] overflow-y-auto">
              {userVideos.length > 0 ? (
                userVideos.map((video, index) => (
                  <div 
                    key={index} 
                    className="p-4 bg-gray-800 border border-gray-700 rounded-xl hover:border-gray-600 transition-colors"
                  >
                    <div className="flex flex-col space-y-2">
                      <p className="text-sm font-medium text-white">
                        {video.name}
                      </p>
                      <p className="text-xs text-white opacity-60">
                        Category: {video.category.replace("-", " ")}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-white opacity-60">No uploaded videos yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 