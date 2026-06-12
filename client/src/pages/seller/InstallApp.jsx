// InstallApp.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const InstallApp = () => {
  const navigate = useNavigate();
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Détection de la plateforme
    const userAgent = navigator.userAgent;
    setIsIOS(/iphone|ipad|ipod/i.test(userAgent));
    setIsAndroid(/android/i.test(userAgent));
  }, []);

  const handlePlatformSelect = (platform) => {
    setSelectedPlatform(platform);
  };

  const handleBack = () => {
    if (selectedPlatform) {
      setSelectedPlatform(null);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="install-app-container">
      {/* Header */}
      <div className="install-header">
        <button className="back-btn" onClick={handleBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1>Installer RAMCI</h1>
        <div style={{ width: 40 }}></div>
      </div>

      {/* Hero Section */}
      <div className="hero-section">
        <div className="hero-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="1.5">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12" y2="18" strokeWidth="2.5" />
          </svg>
        </div>
        <h2>Application RAMCI</h2>
        <p>Installez notre application pour une expérience<br />d'achat plus rapide et fluide</p>
      </div>

      {/* Platform Selection */}
      {!selectedPlatform && (
        <div className="platform-selection">
          <div className="platform-buttons">
            <button 
              className={`platform-btn android ${isAndroid ? 'recommended' : ''}`}
              onClick={() => handlePlatformSelect('android')}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.523 15.3414c-.5648 0-1.0227.428-1.0227.956s.4579.956 1.0227.956c.5648 0 1.0227-.428 1.0227-.956s-.4579-.956-1.0227-.956zm-11.046 0c-.5648 0-1.0227.428-1.0227.956s.4579.956 1.0227.956c.5648 0 1.0227-.428 1.0227-.956s-.4579-.956-1.0227-.956z"/>
                <path d="M12.002 2.003c-1.942 0-3.85.585-5.437 1.667l-1.47-1.47c-.292-.293-.767-.293-1.06 0-.293.292-.293.767 0 1.06l1.283 1.283c-1.236 1.24-2.15 2.81-2.66 4.546h18.688c-.51-1.736-1.424-3.306-2.66-4.546l1.284-1.283c.292-.293.292-.768 0-1.06-.293-.293-.768-.293-1.06 0l-1.47 1.47c-1.587-1.082-3.495-1.667-5.437-1.667zM6.088 8.928c-.465 0-.842-.378-.842-.843 0-.466.377-.843.842-.843.465 0 .842.377.842.843 0 .465-.377.843-.842.843zm11.824 0c-.465 0-.842-.378-.842-.843 0-.466.377-.843.842-.843.465 0 .842.377.842.843 0 .465-.377.843-.842.843z"/>
              </svg>
              <span>Android</span>
              {isAndroid && <span className="badge">Détecté</span>}
            </button>
            <button 
              className={`platform-btn ios ${isIOS ? 'recommended' : ''}`}
              onClick={() => handlePlatformSelect('ios')}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17.36 3 12.16 5.37 8.65c1.19-1.65 3.08-2.7 5.09-2.73 1.34-.03 2.6.9 3.42.9.82 0 2.35-1.11 3.96-.95.67.03 2.56.27 3.77 2.04-.09.06-2.25 1.31-2.23 3.92.02 3.12 2.73 4.16 2.76 4.17-.02.06-.43 1.47-1.43 2.92zM16.2 3.8c.95-1.15 1.59-2.74 1.41-4.33-1.37.06-3.02.91-4 2.06-.88.99-1.65 2.59-1.44 4.11 1.52.12 3.07-.76 4.03-1.84z"/>
              </svg>
              <span>iOS</span>
              {isIOS && <span className="badge">Détecté</span>}
            </button>
          </div>
          
          <div className="features-list">
            <div className="feature">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Navigation plus rapide</span>
            </div>
            <div className="feature">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span>Notifications exclusives</span>
            </div>
            <div className="feature">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              <span>Accès hors ligne</span>
            </div>
          </div>
        </div>
      )}

      {/* Android Installation Guide */}
      {selectedPlatform === 'android' && (
        <div className="guide-content android-guide">
          <div className="steps-container">
            <div className="step-card">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Cliquez sur les trois points</h3>
                <p>En haut à droite de votre navigateur Chrome</p>
                <div className="step-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5">
                    <circle cx="12" cy="6" r="1.5" fill="#333" />
                    <circle cx="12" cy="12" r="1.5" fill="#333" />
                    <circle cx="12" cy="18" r="1.5" fill="#333" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="step-card">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Ajouter à l'écran d'accueil</h3>
                <p>Dans le menu déroulant, sélectionnez "Ajouter à l'écran d'accueil"</p>
                <div className="menu-preview">
                  <div className="menu-item">⭐ Ajouter à l'écran d'accueil</div>
                </div>
              </div>
            </div>

            <div className="step-card">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Confirmer l'installation</h3>
                <p>Cliquez sur "Installer" pour ajouter RAMCI sur votre téléphone</p>
              </div>
            </div>
          </div>

          <div className="success-message">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12l3 3 6-6" />
            </svg>
            <p>Après quelques secondes, vous verrez l'application RAMCI installée sur votre écran d'accueil !</p>
          </div>
        </div>
      )}

      {/* iOS Installation Guide */}
      {selectedPlatform === 'ios' && (
        <div className="guide-content ios-guide">
          <div className="steps-container">
            <div className="step-card">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Cliquez sur Partager</h3>
                <p>Appuyez sur le bouton Partager en bas de Safari</p>
                <div className="share-icon-preview">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="1.8">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="step-card">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>En voir plus</h3>
                <p>Faites défiler vers la droite et cliquez sur "En voir plus"</p>
              </div>
            </div>

            <div className="step-card">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Sur l'écran d'accueil</h3>
                <p>Sélectionnez "Sur l'écran d'accueil" dans les options</p>
                <div className="menu-preview ios-menu">
                  <div className="menu-item">📱 Sur l'écran d'accueil</div>
                </div>
              </div>
            </div>

            <div className="step-card">
              <div className="step-number">4</div>
              <div className="step-content">
                <h3>Ajouter</h3>
                <p>Cliquez sur "Ajouter" en haut à droite pour finaliser</p>
              </div>
            </div>
          </div>

          <div className="success-message">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12l3 3 6-6" />
            </svg>
            <p>Vous verrez RAMCI installée sur votre écran d'accueil et pourrez en profiter !</p>
          </div>

          <div className="ios-note">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <circle cx="12" cy="16" r="0.5" fill="#666" />
            </svg>
            <p>Cette installation fonctionne uniquement avec le navigateur Safari sur iPhone/iPad</p>
          </div>
        </div>
      )}

      <style jsx>{`
        .install-app-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #fff 0%, #fef5f5 100%);
          font-family: 'DM Sans', sans-serif;
        }

        /* Header */
        .install-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: white;
          border-bottom: 1px solid #f0ede8;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .back-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          transition: background 0.2s;
        }

        .back-btn:hover {
          background: #f5f5f5;
        }

        .install-header h1 {
          font-size: 18px;
          font-weight: 600;
          color: #111;
          margin: 0;
        }

        /* Hero */
        .hero-section {
          text-align: center;
          padding: 32px 20px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          color: white;
        }

        .hero-icon {
          width: 80px;
          height: 80px;
          background: rgba(255,255,255,0.15);
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          backdrop-filter: blur(10px);
        }

        .hero-section h2 {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 8px;
          color: white;
        }

        .hero-section p {
          font-size: 14px;
          opacity: 0.8;
          line-height: 1.5;
        }

        /* Platform Selection */
        .platform-selection {
          padding: 32px 20px;
        }

        .platform-buttons {
          display: flex;
          gap: 16px;
          justify-content: center;
          margin-bottom: 40px;
          flex-wrap: wrap;
        }

        .platform-btn {
          flex: 1;
          min-width: 140px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 24px 20px;
          background: white;
          border: 2px solid #e0e0e0;
          border-radius: 24px;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
        }

        .platform-btn.android:hover {
          border-color: #3ddc84;
          transform: translateY(-4px);
          box-shadow: 0 8px 20px rgba(61,220,132,0.2);
        }

        .platform-btn.ios:hover {
          border-color: #e53935;
          transform: translateY(-4px);
          box-shadow: 0 8px 20px rgba(229,57,53,0.2);
        }

        .platform-btn.recommended {
          border-color: #e53935;
          background: linear-gradient(135deg, #fff, #fff5f5);
        }

        .platform-btn span:first-of-type {
          font-size: 18px;
          font-weight: 600;
          color: #111;
        }

        .badge {
          position: absolute;
          top: -10px;
          right: -10px;
          background: #e53935;
          color: white;
          font-size: 10px;
          padding: 4px 8px;
          border-radius: 20px;
          font-weight: 500;
        }

        /* Features */
        .features-list {
          background: white;
          border-radius: 20px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }

        .feature {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid #f0ede8;
        }

        .feature:last-child {
          border-bottom: none;
        }

        .feature span {
          font-size: 14px;
          color: #333;
        }

        /* Guide Content */
        .guide-content {
          padding: 20px;
          animation: fadeIn 0.4s ease;
        }

        .steps-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 32px;
        }

        .step-card {
          background: white;
          border-radius: 20px;
          padding: 20px;
          display: flex;
          gap: 16px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .step-card:hover {
          transform: translateX(4px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        }

        .step-number {
          width: 36px;
          height: 36px;
          background: #1a1a2e;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .step-content {
          flex: 1;
        }

        .step-content h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 6px 0;
          color: #111;
        }

        .step-content p {
          font-size: 13px;
          color: #666;
          margin: 0 0 12px 0;
        }

        .step-icon {
          background: #f5f5f5;
          border-radius: 12px;
          padding: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .share-icon-preview {
          background: #f5f5f5;
          border-radius: 12px;
          padding: 8px 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .menu-preview {
          background: #f5f5f5;
          border-radius: 12px;
          padding: 8px;
          max-width: 200px;
        }

        .menu-item {
          padding: 8px 12px;
          background: white;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          color: #333;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .ios-menu .menu-item {
          color: #e53935;
        }

        /* Success Message */
        .success-message {
          background: linear-gradient(135deg, #e8f5e9 0%, #e0f2e9 100%);
          border-radius: 20px;
          padding: 24px;
          text-align: center;
          margin-top: 24px;
        }

        .success-message svg {
          margin-bottom: 12px;
        }

        .success-message p {
          font-size: 14px;
          font-weight: 500;
          color: #2e7d32;
          margin: 0;
        }

        /* iOS Note */
        .ios-note {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #fff3e0;
          border-radius: 12px;
          padding: 12px 16px;
          margin-top: 20px;
        }

        .ios-note p {
          font-size: 12px;
          color: #e65100;
          margin: 0;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 480px) {
          .platform-buttons {
            flex-direction: column;
          }
          
          .platform-btn {
            flex-direction: row;
            justify-content: center;
          }
          
          .hero-section h2 {
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  );
};

export default InstallApp;