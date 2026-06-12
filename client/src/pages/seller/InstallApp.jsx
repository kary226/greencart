import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";  // ← Ajouter la virgule ici

const InstallApp = () => {
  const navigate = useNavigate();
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);

  const handleBack = () => {
    if (selectedPlatform) {
      setSelectedPlatform(null);
    } else {
      navigate(-1);
    }
  };

  const handleAndroidInstall = () => {
    setSelectedPlatform('android');
  };

  const handleIOSInstall = () => {
    setSelectedPlatform('ios');
    setShowIOSGuide(true);
  };

  return (
    <>
      <div className="install-app-container">
        <div className="install-header">
          <button className="install-back-btn" onClick={handleBack}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1>Installer RAMCI</h1>
          <div style={{ width: 40 }}></div>
        </div>

        {!selectedPlatform ? (
          <>
            <div className="install-hero">
              <div className="install-hero-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="1.5">
                  <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12" y2="18" strokeWidth="2.5" />
                </svg>
              </div>
              <h2>Application RAMCI</h2>
              <p>Installez notre application pour une expérience<br />d'achat plus rapide et fluide</p>
            </div>

            <div className="install-platforms">
              <div className="install-platform-buttons">
                <button 
                  className={`install-platform-btn android ${isAndroid ? 'detected' : ''}`}
                  onClick={handleAndroidInstall}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.523 15.3414c-.5648 0-1.0227.428-1.0227.956s.4579.956 1.0227.956c.5648 0 1.0227-.428 1.0227-.956s-.4579-.956-1.0227-.956zm-11.046 0c-.5648 0-1.0227.428-1.0227.956s.4579.956 1.0227.956c.5648 0 1.0227-.428 1.0227-.956s-.4579-.956-1.0227-.956z"/>
                    <path d="M12.002 2.003c-1.942 0-3.85.585-5.437 1.667l-1.47-1.47c-.292-.293-.767-.293-1.06 0-.293.292-.293.767 0 1.06l1.283 1.283c-1.236 1.24-2.15 2.81-2.66 4.546h18.688c-.51-1.736-1.424-3.306-2.66-4.546l1.284-1.283c.292-.293.292-.768 0-1.06-.293-.293-.768-.293-1.06 0l-1.47 1.47c-1.587-1.082-3.495-1.667-5.437-1.667zM6.088 8.928c-.465 0-.842-.378-.842-.843 0-.466.377-.843.842-.843.465 0 .842.377.842.843 0 .465-.377.843-.842.843zm11.824 0c-.465 0-.842-.378-.842-.843 0-.466.377-.843.842-.843.465 0 .842.377.842.843 0 .465-.377.843-.842.843z"/>
                  </svg>
                  <span>Android</span>
                  {isAndroid && <span className="detected-badge">Détecté</span>}
                </button>
                <button 
                  className={`install-platform-btn ios ${isIOS ? 'detected' : ''}`}
                  onClick={handleIOSInstall}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17.36 3 12.16 5.37 8.65c1.19-1.65 3.08-2.7 5.09-2.73 1.34-.03 2.6.9 3.42.9.82 0 2.35-1.11 3.96-.95.67.03 2.56.27 3.77 2.04-.09.06-2.25 1.31-2.23 3.92.02 3.12 2.73 4.16 2.76 4.17-.02.06-.43 1.47-1.43 2.92zM16.2 3.8c.95-1.15 1.59-2.74 1.41-4.33-1.37.06-3.02.91-4 2.06-.88.99-1.65 2.59-1.44 4.11 1.52.12 3.07-.76 4.03-1.84z"/>
                  </svg>
                  <span>iOS</span>
                  {isIOS && <span className="detected-badge">Détecté</span>}
                </button>
              </div>

              <div className="install-features">
                <div className="install-feature">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Navigation plus rapide</span>
                </div>
                <div className="install-feature">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  <span>Notifications exclusives</span>
                </div>
                <div className="install-feature">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  <span>Accès rapide</span>
                </div>
              </div>
            </div>
          </>
        ) : selectedPlatform === 'android' ? (
          <div className="install-guide-android">
            <div className="guide-steps">
              <div className="guide-step">
                <div className="step-number">1</div>
                <div className="step-text">
                  <strong>Cliquez sur les trois points</strong>
                  <p>En haut à droite de votre navigateur Chrome</p>
                </div>
              </div>
              <div className="guide-step">
                <div className="step-number">2</div>
                <div className="step-text">
                  <strong>Ajouter à l'écran d'accueil</strong>
                  <p>Dans le menu déroulant, sélectionnez cette option</p>
                </div>
              </div>
              <div className="guide-step">
                <div className="step-number">3</div>
                <div className="step-text">
                  <strong>Confirmer l'installation</strong>
                  <p>Cliquez sur "Installer" pour ajouter RAMCI</p>
                </div>
              </div>
            </div>
            <div className="guide-success">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12l3 3 6-6" />
              </svg>
              <p>RAMCI sera installée sur votre écran d'accueil !</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Modal iOS */}
      {showIOSGuide && (
        <div className="filters-modal" onClick={() => setShowIOSGuide(false)}>
          <div className="filters-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="filters-header">
              <h3>Installer RAMCI</h3>
              <button onClick={() => setShowIOSGuide(false)}>✕</button>
            </div>
            <div className="ios-guide-body">
              <div className="ios-step">
                <div className="ios-step-num">1</div>
                <div className="ios-step-text">
                  Appuyez sur le bouton <strong>Partager</strong>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" style={{verticalAlign:'middle', margin:'0 4px'}}>
                    <path d="M8 12H3v9h18v-9h-5"/>
                    <polyline points="12 3 12 15"/>
                    <polyline points="8 7 12 3 16 7"/>
                  </svg>
                  en bas de Safari
                </div>
              </div>
              <div className="ios-step">
                <div className="ios-step-num">2</div>
                <div className="ios-step-text">Faites défiler et appuyez sur <strong>« Sur l'écran d'accueil »</strong></div>
              </div>
              <div className="ios-step">
                <div className="ios-step-num">3</div>
                <div className="ios-step-text">Appuyez sur <strong>Ajouter</strong> en haut à droite</div>
              </div>
              <p className="ios-note">⚠️ Fonctionne uniquement avec <strong>Safari</strong> sur iPhone/iPad.</p>
            </div>
            <div className="filters-footer">
              <button onClick={() => setShowIOSGuide(false)} className="apply-btn">Compris !</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .install-app-container {
          min-height: 100vh;
          background: #fff;
        }

        .install-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #f0ede8;
          position: sticky;
          top: 0;
          background: #fff;
          z-index: 10;
        }

        .install-back-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
        }

        .install-header h1 {
          font-size: 18px;
          font-weight: 600;
          color: #111;
          margin: 0;
        }

        .install-hero {
          text-align: center;
          padding: 40px 20px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          color: white;
        }

        .install-hero-icon {
          width: 80px;
          height: 80px;
          background: rgba(255,255,255,0.1);
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
        }

        .install-hero h2 {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 8px;
          color: white;
        }

        .install-hero p {
          font-size: 14px;
          opacity: 0.8;
        }

        .install-platforms {
          padding: 32px 20px;
        }

        .install-platform-buttons {
          display: flex;
          gap: 16px;
          margin-bottom: 32px;
        }

        .install-platform-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 24px 20px;
          background: white;
          border: 2px solid #e0e0e0;
          border-radius: 24px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .install-platform-btn.android:hover {
          border-color: #3ddc84;
          transform: translateY(-2px);
        }

        .install-platform-btn.ios:hover {
          border-color: #e53935;
          transform: translateY(-2px);
        }

        .install-platform-btn.detected {
          border-color: #e53935;
          background: #fff5f5;
        }

        .install-platform-btn span {
          font-size: 16px;
          font-weight: 600;
          color: #111;
        }

        .detected-badge {
          position: absolute;
          top: -10px;
          right: -10px;
          background: #e53935;
          color: white;
          font-size: 10px;
          padding: 4px 8px;
          border-radius: 20px;
        }

        .install-features {
          background: #faf8f5;
          border-radius: 20px;
          padding: 20px;
        }

        .install-feature {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid #f0ede8;
        }

        .install-feature:last-child {
          border-bottom: none;
        }

        .install-feature span {
          font-size: 14px;
          color: #333;
        }

        .install-guide-android {
          padding: 20px;
        }

        .guide-steps {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-bottom: 32px;
        }

        .guide-step {
          display: flex;
          gap: 16px;
          background: #faf8f5;
          padding: 20px;
          border-radius: 20px;
        }

        .step-number {
          width: 32px;
          height: 32px;
          background: #1a1a2e;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }

        .step-text strong {
          display: block;
          font-size: 15px;
          margin-bottom: 4px;
          color: #111;
        }

        .step-text p {
          font-size: 13px;
          color: #666;
          margin: 0;
        }

        .guide-success {
          background: #e8f5e9;
          border-radius: 20px;
          padding: 20px;
          text-align: center;
        }

        .guide-success p {
          font-size: 14px;
          font-weight: 500;
          color: #2e7d32;
          margin: 8px 0 0;
        }

        .filters-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          z-index: 1001;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .filters-modal-content {
          background: white;
          border-radius: 20px;
          width: 90%;
          max-width: 400px;
          overflow: hidden;
        }

        .filters-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #eee;
        }

        .filters-header h3 {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
        }

        .filters-header button {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
        }

        .ios-guide-body {
          padding: 20px;
        }

        .ios-step {
          display: flex;
          gap: 14px;
          margin-bottom: 20px;
        }

        .ios-step-num {
          width: 28px;
          height: 28px;
          background: #111;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 600;
        }

        .ios-step-text {
          font-size: 14px;
          color: #333;
          line-height: 1.5;
        }

        .ios-note {
          font-size: 12px;
          color: #888;
          background: #faf8f5;
          padding: 10px 12px;
          border-radius: 10px;
          margin: 16px 0 0;
        }

        .filters-footer {
          padding: 16px 20px;
          border-top: 1px solid #eee;
        }

        .apply-btn {
          width: 100%;
          padding: 12px;
          background: #111;
          color: white;
          border: none;
          border-radius: 40px;
          font-weight: 500;
          cursor: pointer;
        }

        @media (max-width: 480px) {
          .install-platform-buttons {
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
};

export default InstallApp;