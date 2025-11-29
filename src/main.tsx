import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { auth } from './utils/firebase';

// Initialize Firebase before rendering the app
const initApp = async () => {
  // Wait for Firebase to initialize
  await new Promise<void>((resolve) => {
    const unsubscribe = auth.onAuthStateChanged(() => {
      unsubscribe();
      resolve();
    });
  });

  // Now render the app
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};

// Start the app
initApp().catch((error) => {
  console.error('Failed to initialize app:', error);
});
