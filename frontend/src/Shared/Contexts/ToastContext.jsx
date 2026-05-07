import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import ToastContainer from '../Components/Toast/ToastContainer';

const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

let _idCounter = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  // Garde-fou anti-doublon : stocke "message|type" → timestamp du dernier appel
  const recentRef = useRef({});

  const addToast = useCallback((message, type = 'info') => {
    const key = `${type}|${message}`;
    const now = Date.now();
    // Si le même toast a été affiché il y a moins de 400ms, on ignore
    if (recentRef.current[key] && now - recentRef.current[key] < 400) return;
    recentRef.current[key] = now;

    const id = ++_idCounter;
    setToasts(prev => [...prev, { id, message, type, exiting: false }]);

    // Start exit animation after 3.5s, remove after 4s
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 400);
    }, 3500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 400);
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};
