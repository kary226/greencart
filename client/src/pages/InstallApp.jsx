import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const InstallApp = () => {
  const navigate = useNavigate();
  const [selectedPlatform, setSelectedPlatform] = useState(null);

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);

  const handleBack = () => {
    if (selectedPlatform) {
      setSelectedPlatform(null);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="install-page">
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

      {/* Choix de la plateforme */}
      {!selectedPlatform && (
        <>
          <div className="hero-section">
            <div className="hero-icon">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="1.5">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12" y2="18" strokeWidth="2.5" />
              </svg>
            </div>
            <h2>Application RAMCI</h2>
            <p>Installez notre application pour une expérience<br />d'achat plus rapide et fluide</p>
          </div>

          <div className="platform-buttons">
            <button 
              className={`platform-btn android ${isAndroid ? 'detected' : ''}`}
              onClick={() => setSelectedPlatform('android')}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.523 15.3414c-.5648 0-1.0227.428-1.0227.956s.4579.956 1.0227.956c.5648 0 1.0227-.428 1.0227-.956s-.4579-.956-1.0227-.956zm-11.046 0c-.5648 0-1.0227.428-1.0227.956s.4579.956 1.0227.956c.5648 0 1.0227-.428 1.0227-.956s-.4579-.956-1.0227-.956z"/>
                <path d="M12.002 2.003c-1.942 0-3.85.585-5.437 1.667l-1.47-1.47c-.292-.293-.767-.293-1.06 0-.293.292-.293.767 0 1.06l1.283 1.283c-1.236 1.24-2.15 2.81-2.66 4.546h18.688c-.51-1.736-1.424-3.306-2.66-4.546l1.284-1.283c.292-.293.292-.768 0-1.06-.293-.293-.768-.293-1.06 0l-1.47 1.47c-1.587-1.082-3.495-1.667-5.437-1.667zM6.088 8.928c-.465 0-.842-.378-.842-.843 0-.466.377-.843.842-.843.465 0 .842.377.842.843 0 .465-.377.843-.842.843zm11.824 0c-.465 0-.842-.378-.842-.843 0-.466.377-.843.842-.843.465 0 .842.377.842.843 0 .465-.377.843-.842.843z"/>
              </svg>
              <span>Android</span>
              {isAndroid && <span className="badge">Détecté</span>}
            </button>
            <button 
              className={`platform-btn ios ${isIOS ? 'detected' : ''}`}
              onClick={() => setSelectedPlatform('ios')}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17.36 3 12.16 5.37 8.65c1.19-1.65 3.08-2.7 5.09-2.73 1.34-.03 2.6.9 3.42.9.82 0 2.35-1.11 3.96-.95.67.03 2.56.27 3.77 2.04-.09.06-2.25 1.31-2.23 3.92.02 3.12 2.73 4.16 2.76 4.17-.02.06-.43 1.47-1.43 2.92zM16.2 3.8c.95-1.15 1.59-2.74 1.41-4.33-1.37.06-3.02.91-4 2.06-.88.99-1.65 2.59-1.44 4.11 1.52.12 3.07-.76 4.03-1.84z"/>
              </svg>
              <span>iOS</span>
              {isIOS && <span className="badge">Détecté</span>}
            </button>
          </div>

          <div className="features">
            <div className="feature">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Navigation plus rapide</span>
            </div>
            <div className="feature">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span>Notifications exclusives</span>
            </div>
            <div className="feature">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              <span>Accès rapide</span>
            </div>
          </div>
        </>
      )}

      {/* Guide Android */}
      {selectedPlatform === 'android' && (
        <div className="guide-container">
          <div className="guide-header">
            <h2>Installation Android</h2>
            <p>Suivez ces étapes simples</p>
          </div>

          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Cliquez sur les trois points</h3>
                <p>En haut à droite de votre navigateur Chrome</p>
                <div className="step-image">
                  <img src="/images/install/android-step1.png" alt="Étape 1 Android" />
                </div>
              </div>
            </div>

            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Ajouter à l'écran d'accueil</h3>
                <p>Sélectionnez "Ajouter à l'écran d'accueil" dans le menu</p>
                <div className="step-image">
                  <img src="/images/install/android-step2.png" alt="Étape 2 Android" />
                </div>
              </div>
            </div>

            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Installer l'application</h3>
                <p>Cliquez sur "Installer" pour finaliser</p>
                <div className="step-image">
                  <img src="/images/install/android-step3.png" alt="Étape 3 Android" />
                </div>
              </div>
            </div>

            {/* IMAGE DE FIN ANDROID */}
            <div className="step final-step">
              <div className="step-number">✓</div>
              <div className="step-content">
                <h3>Installation terminée !</h3>
                <p>L'application est maintenant sur votre écran d'accueil</p>
                <div className="step-image">
                  <img src="/images/install/android-fin.png" alt="Installation terminée Android" />
                </div>
              </div>
            </div>
          </div>

          <div className="success-message">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12l3 3 6-6" />
            </svg>
            <p>Après quelques secondes, vous verrez l'application RAMCI installée sur votre téléphone !</p>
          </div>
        </div>
      )}

      {/* Guide iOS */}
      {selectedPlatform === 'ios' && (
        <div className="guide-container">
          <div className="guide-header">
            <h2>Installation iOS</h2>
            <p>Suivez ces étapes dans Safari</p>
          </div>

          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Cliquez sur Partager</h3>
                <p>Appuyez sur le bouton Partager en bas de Safari</p>
                <div className="step-image">
                  <img src="/images/install/ios-step1.png" alt="Étape 1 iOS" />
                </div>
              </div>
            </div>

            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Cliquez sur "En voir plus"</h3>
                <p>Faites défiler vers la droite et appuyez sur "En voir plus"</p>
                <div className="step-image">
                  <img src="/images/install/ios-step2.png" alt="Étape 2 iOS" />
                </div>
              </div>
            </div>

            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Sur l'écran d'accueil</h3>
                <p>Sélectionnez "Sur l'écran d'accueil" dans les options</p>
                <div className="step-image">
                  <img src="/images/install/ios-step3.png" alt="Étape 3 iOS" />
                </div>
              </div>
            </div>

            <div className="step">
              <div className="step-number">4</div>
              <div className="step-content">
                <h3>Ajouter</h3>
                <p>Cliquez sur "Ajouter" en haut à droite</p>
                <div className="step-image">
                  <img src="/images/install/ios-step4.png" alt="Étape 4 iOS" />
                </div>
              </div>
            </div>

            {/* IMAGE DE FIN iOS */}
            <div className="step final-step">
              <div className="step-number">✓</div>
              <div className="step-content">
                <h3>Installation terminée !</h3>
                <p>RAMCI est maintenant sur votre écran d'accueil</p>
                <div className="step-image">
                  <img src="/images/install/ios-fin.png" alt="Installation terminée iOS" />
                </div>
              </div>
            </div>
          </div>

          <div className="success-message">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12l3 3 6-6" />
            </svg>
            <p>Vous verrez RAMCI installée sur votre écran d'accueil !</p>
          </div>

          <div className="ios-note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <circle cx="12" cy="16" r="0.5" fill="#e53935" />
            </svg>
            <p>⚠️ Fonctionne uniquement avec le navigateur Safari sur iPhone/iPad</p>
          </div>
        </div>
      )}

      <style>{`
        .install-page {
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
          z-index: 100;
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

        .hero-section {
          text-align: center;
          padding: 40px 20px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          color: white;
        }

        .hero-icon {
          width: 80px;
          height: 80px;
          background: rgba(255,255,255,0.1);
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
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

        .platform-buttons {
          display: flex;
          gap: 16px;
          padding: 32px 20px;
        }

        .platform-btn {
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

        .platform-btn.android:hover {
          border-color: #3ddc84;
          transform: translateY(-2px);
        }

        .platform-btn.ios:hover {
          border-color: #e53935;
          transform: translateY(-2px);
        }

        .platform-btn.detected {
          border-color: #e53935;
          background: #fff5f5;
        }

        .platform-btn span {
          font-size: 16px;
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
        }

        .features {
          background: #faf8f5;
          border-radius: 20px;
          margin: 0 20px 20px;
          padding: 20px;
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

        .guide-container {
          padding: 20px;
        }

        .guide-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .guide-header h2 {
          font-size: 22px;
          font-weight: 600;
          color: #111;
          margin-bottom: 6px;
        }

        .guide-header p {
          font-size: 13px;
          color: #888;
        }

        .steps {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .step {
          display: flex;
          gap: 16px;
          background: #faf8f5;
          padding: 20px;
          border-radius: 20px;
        }

        .final-step {
          background: #e8f5e9;
          border: 1px solid #c8e6c9;
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
          font-size: 16px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .final-step .step-number {
          background: #4caf50;
        }

        .step-content {
          flex: 1;
        }

        .step-content h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 4px 0;
          color: #111;
        }

        .step-content p {
          font-size: 13px;
          color: #666;
          margin: 0 0 12px 0;
        }

        .step-image {
          margin-top: 12px;
          border-radius: 16px;
          overflow: hidden;
          background: #fff;
          border: 1px solid #eee;
        }

        .step-image img {
          width: 100%;
          max-width: 280px;
          display: block;
          margin: 0 auto;
        }

        .success-message {
          background: #e8f5e9;
          border-radius: 20px;
          padding: 20px;
          text-align: center;
          margin-top: 32px;
        }

        .success-message p {
          font-size: 14px;
          font-weight: 500;
          color: #2e7d32;
          margin: 12px 0 0;
        }

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

        @media (max-width: 480px) {
          .platform-buttons {
            flex-direction: column;
          }

          .step {
            flex-direction: column;
          }

          .step-number {
            width: 28px;
            height: 28px;
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  );
};

export default InstallApp;