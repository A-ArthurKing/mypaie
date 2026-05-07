import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Dans Mypaie, l'API est proxifiée par Vite sur le même port que le front
    // On utilise l'URL de base pour la connexion socket
    const newSocket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket']
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[Socket] Connecté au serveur temps réel');
    });

    newSocket.on('disconnect', () => {
      console.log('[Socket] Déconnecté');
    });

    return () => newSocket.close();
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
