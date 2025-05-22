import { useState, useEffect } from 'react';

export function useOfflineDetection() {
  const [isOffline, setIsOffline] = useState(false);
  
  useEffect(() => {
    // Check initial status
    setIsOffline(!navigator.onLine);
    
    // Set up listeners for online/offline events
    const handleOnline = () => {
      setIsOffline(false);
    };
    
    const handleOffline = () => {
      setIsOffline(true);
    };
    
    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Clean up on unmount
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOffline;
} 