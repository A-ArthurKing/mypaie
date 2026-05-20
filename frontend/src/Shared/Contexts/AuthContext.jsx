/*
 * Fichier : AuthContext.jsx
 * Rôle    : Gestion de l'état d'authentification de l'utilisateur avec backend JWT.
 * Module  : mypaie / src / Shared / Contexts
 */
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Vérifier le token au chargement
  useEffect(() => {
    const checkToken = async () => {
      const token = localStorage.getItem('mypaie_auth_token');
      if (token) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem('mypaie_auth_token');
          }
        } catch (e) {
          console.error("Erreur de vérification token", e);
        }
      }
      setIsLoading(false);
    };
    checkToken();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Erreur de connexion");
      }
      
      localStorage.setItem('mypaie_auth_token', data.token);
      setUser(data.user);
      setIsAuthenticated(true);
      return data.user;
    } catch (err) {
      throw err;
    }
  };

  const loginCollaborateur = async (nom, prenom) => {
    try {
      const res = await fetch('/api/auth/login-collaborateur', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom, prenom })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur de connexion");
      }

      localStorage.setItem('mypaie_auth_token', data.token);
      setUser(data.user);
      setIsAuthenticated(true);
      return data.user;
    } catch (err) {
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('mypaie_auth_token');
    setIsAuthenticated(false);
    setUser(null);
  };

  if (isLoading) {
    return <div className="loading-app">Chargement...</div>;
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, loginCollaborateur, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
