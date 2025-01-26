# Click Clock - Video Sharing Platform

Click Clock is a modern video sharing platform built with Next.js, Firebase, and Tailwind CSS. It offers features similar to TikTok, allowing users to upload, view, like, and comment on short videos.

## Features

- 📱 Responsive video player with autoplay
- 👤 User authentication and profiles
- 🎥 Video upload with category selection
- 💬 Real-time comments
- ❤️ Like/unlike functionality
- 🔄 Video sharing
- 🎯 Personalized video recommendations
- 📊 User activity tracking (likes, comments, uploads)

## Prerequisites

Before you begin, ensure you have:
- Node.js (v14 or higher)
- npm or yarn
- A Firebase account
- Git

## Getting Started

1. Clone the repository:
bash
git clone https://github.com/Jomaguy/Click_Clock.git
cd Click_Clock


2. Install dependencies:
bash
npm install
or
yarn install


3. Set up Firebase:
- Create a new Firebase project
- Enable Authentication, Firestore, and Storage
- Copy your Firebase config

4. Create a `.env.local` file in the root directory:
env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id



5. Start the development server:
bash
npm run dev
or
yarn dev


6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

- `/app` - Next.js app directory
- `/app/page.tsx` - Main application component
- `/app/lib/firebase.ts` - Firebase configuration
- `/public` - Static assets

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

Jonathan Mahrt - [@MyLinkedin]((https://www.linkedin.com/in/jonathan-mahrt-guyou/))
Project Link: [https://github.com/Jomaguy/Click_Clock](https://github.com/Jomaguy/Click_Clock)
