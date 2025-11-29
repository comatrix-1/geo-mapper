import React, { useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, googleProvider } from '../utils/firebase';
import { LogIn, LogOut, User as UserIcon, AlertCircle, X, ExternalLink } from 'lucide-react';

interface AuthWidgetProps {
  user: User | null;
}

const AuthWidget: React.FC<AuthWidgetProps> = ({ user }) => {
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed", error);
      
      const hostname = window.location.hostname;
      const errorCode = error.code;
      const errorMessage = error.message || '';

      // Handle Domain Unauthorized Error
      if (errorCode === 'auth/unauthorized-domain' || errorMessage.includes('unauthorized-domain')) {
          const displayDomain = hostname || window.location.host || 'your-current-domain';
          
          setError(
            `Domain Not Authorized\n\n` +
            `Firebase blocked the sign-in attempt from: "${displayDomain}"\n` +
            (!hostname ? '(Note: Browser did not report a standard hostname. Check your address bar.)\n' : '') +
            `\nTo fix this:\n` +
            `1. Go to Firebase Console > Authentication > Settings > Authorized Domains\n` +
            `2. Click "Add Domain"\n` +
            `3. Enter: ${displayDomain}`
          );
      } 
      // Handle Invalid Config/API Key
      else if (errorCode === 'auth/api-key-not-valid') {
          setError("Invalid API Key. Please ensure you have replaced the placeholder config in utils/firebase.ts with your own project keys.");
      } 
      // Handle User Cancelled
      else if (errorCode === 'auth/popup-closed-by-user' || errorCode === 'auth/cancelled-popup-request') {
          return; // Ignore
      } 
      // Generic Fallback
      else {
          setError(errorMessage);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  if (user) {
    console.log('user: ', user);
    return (
      <div className="flex items-center gap-2 bg-white/90 backdrop-blur border border-gray-200 rounded-full pl-1 pr-3 py-1 shadow-sm">
        {user.photoURL ? (
          <img 
            src={user.photoURL} 
            alt="Profile" 
            className="w-7 h-7 rounded-full border border-gray-200"
          />
        ) : (
          <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
            <UserIcon size={16} />
          </div>
        )}
        <div className="flex flex-col leading-none mr-2">
            <span className="text-[10px] text-gray-400 font-semibold uppercase">Logged In</span>
            <span className="text-xs font-medium text-gray-700 max-w-[80px] truncate">{user.displayName || 'User'}</span>
        </div>
        <button 
          onClick={handleLogout}
          className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-colors"
          title="Sign Out"
        >
          <LogOut size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
        <button
            onClick={handleLogin}
            className="flex items-center gap-2 bg-white/90 backdrop-blur border border-gray-200 text-gray-700 px-3 py-1.5 rounded-full shadow-sm hover:bg-gray-50 transition-all text-sm font-medium"
        >
            <LogIn size={16} className="text-blue-600" />
            <span>Sign In</span>
        </button>

        {error && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-red-100 p-4 z-50 animate-fade-in-up">
                <div className="flex justify-between items-start mb-2">
                    <h4 className="text-sm font-bold text-red-600 flex items-center gap-1.5">
                        <AlertCircle size={16} />
                        Login Failed
                    </h4>
                    <button onClick={() => setError(null)} className="text-gray-400 hover:text-gray-600">
                        <X size={16} />
                    </button>
                </div>
                <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-medium">
                    {error}
                </div>
                {error.includes('Domain Not Authorized') && (
                     <div className="mt-3 text-[10px] bg-blue-50 text-blue-800 p-2 rounded border border-blue-100 flex gap-2">
                        <ExternalLink size={14} className="flex-shrink-0 mt-0.5" />
                        <span>Copy the domain above and add it to your Firebase Console under Authentication - Settings.</span>
                     </div>
                )}
            </div>
        )}
    </div>
  );
};

export default AuthWidget;