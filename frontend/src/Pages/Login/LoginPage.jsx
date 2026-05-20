import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../Shared/Contexts/AuthContext';
import './LoginPage.css';

const LoginPage = () => {
  const [mode, setMode] = useState('admin'); // 'admin' | 'collaborateur'

  // Admin fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Collaborateur fields
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');

  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login, loginCollaborateur } = useAuth();
  const navigate = useNavigate();

  const handleSwitchMode = (newMode) => {
    setMode(newMode);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'collaborateur') {
        await loginCollaborateur(nom, prenom);
        navigate('/mon-espace');
      } else {
        await login(email, password);
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">
            <span className="logo-accent">my</span>Paie
          </div>
          <h1 className="login-title">Bienvenue</h1>
          <p className="login-subtitle">Connectez-vous pour accéder à votre espace</p>
        </div>

        {/* Sélecteur de mode */}
        <div className="login-mode-tabs">
          <button
            type="button"
            className={`login-mode-tab ${mode === 'admin' ? 'active' : ''}`}
            onClick={() => handleSwitchMode('admin')}
          >
            <i className="fa-solid fa-shield-halved"></i>
            Espace Admin
          </button>
          <button
            type="button"
            className={`login-mode-tab ${mode === 'collaborateur' ? 'active' : ''}`}
            onClick={() => handleSwitchMode('collaborateur')}
          >
            <i className="fa-solid fa-user"></i>
            Espace Collaborateur
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}

          {mode === 'admin' ? (
            <>
              <div className="form-group">
                <label htmlFor="email">Adresse Email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Entrez votre email"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Mot de passe</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Entrez votre mot de passe"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              <div className="form-options">
                <label className="checkbox-container">
                  <input type="checkbox" />
                  <span className="checkmark"></span>
                  Se souvenir de moi
                </label>
                <a href="#" className="forgot-password">Mot de passe oublié ?</a>
              </div>
            </>
          ) : (
            <>
              <div className="login-collab-hint">
                <i className="fa-solid fa-circle-info"></i>
                Renseignez votre nom et prénom tels qu'enregistrés dans le système.
              </div>

              <div className="form-group">
                <label htmlFor="nom">Nom</label>
                <input
                  type="text"
                  id="nom"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Votre nom de famille"
                  autoComplete="off"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="prenom">Prénom</label>
                <input
                  type="text"
                  id="prenom"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  placeholder="Votre prénom"
                  autoComplete="off"
                  required
                />
              </div>
            </>
          )}

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>
      </div>

      <div className="login-illustration">
        <div className="illustration-content">
          <h2>Performances et primes en temps réel</h2>
          <p>Suivez l'atteinte de vos objectifs et analysez vos résultats en un seul endroit.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

