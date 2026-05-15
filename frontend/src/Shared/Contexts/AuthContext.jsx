/*
 * Fichier : AuthContext.jsx
 * Rôle    : Gestion de l'état d'authentification de l'utilisateur.
 * Module  : mypaie / src / Shared / Contexts
 */
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('mypaie_auth_token') !== null;
  });

  const login = (email, password) => {
    // Simulation d'une API d'authentification
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (email && password) {
          localStorage.setItem('mypaie_auth_token', 'mock_token_123');
          setIsAuthenticated(true);
          resolve();
        } else {
          reject(new Error("Email ou mot de passe invalide."));
        }
      }, 800);
    });
  };

  const logout = () => {
    localStorage.removeItem('mypaie_auth_token');
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
