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

  const androidSteps = [
    { img: "/images/install/android-step1.png", label: "Menu (⋮) en haut à droite" },
    { img: "/images/install/android-step2.png", label: "« Ajouter à l'écran d'accueil »" },
    { img: "/images/install/android-step3.png", label: "Confirmer « Installer »" },
    { img: "/images/install/android-fin.png", label: "App installée 🎉" },
  ];

  const iosSteps = [
    { img: "/images/install/ios-step1.png", label: "Bouton Partager" },
    { img: "/images/install/ios-step2.png", label: "« En voir plus »" },
    { img: "/images/install/ios-step3.png", label: "« Sur l'écran d'accueil »" },
    { img: "/images/install/ios-step4.png", label: "Appuyer sur « Ajouter »" },
  ];

  return (
    <div className="install-page">
      {/* Header */}
      <div className="install-header">
        <button className="back-btn" onClick={handleBack} aria-label="Retour">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1>Installer RAMCI</h1>
        <div style={{ width: 36 }}></div>
      </div>

      {!selectedPlatform && (
        <>
          <div className="hero-section">
            <div className="hero-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5">
                <rect x="4" y="2" width="16" height="20" rx="3" ry="3" />
                <line x1="12" y1="18" x2="12" y2="18" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <h2>Application RAMCI</h2>
            <p>Une expérience d'achat plus rapide,<br />directement depuis votre écran d'accueil</p>
          </div>

          <div className="platform-buttons">
            <button
              className={`platform-btn ${isAndroid ? "detected" : ""}`}
              onClick={() => setSelectedPlatform("android")}
            >
              <div className="platform-icon android-bg">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#3ddc84">
                  <path d="M17.523 15.3414c-.5648 0-1.0227.428-1.0227.956s.4579.956 1.0227.956c.5648 0 1.0227-.428 1.0227-.956s-.4579-.956-1.0227-.956zm-11.046 0c-.5648 0-1.0227.428-1.0227.956s.4579.956 1.0227.956c.5648 0 1.0227-.428 1.0227-.956s-.4579-.956-1.0227-.956z"/>
                  <path d="M12.002 2.003c-1.942 0-3.85.585-5.437 1.667l-1.47-1.47c-.292-.293-.767-.293-1.06 0-.293.292-.293.767 0 1.06l1.283 1.283c-1.236 1.24-2.15 2.81-2.66 4.546h18.688c-.51-1.736-1.424-3.306-2.66-4.546l1.284-1.283c.292-.293.292-.768 0-1.06-.293-.293-.768-.293-1.06 0l-1.47 1.47c-1.587-1.082-3.495-1.667-5.437-1.667zM6.088 8.928c-.465 0-.842-.378-.842-.843 0-.466.377-.843.842-.843.465 0 .842.377.842.843 0 .465-.377.843-.842.843zm11.824 0c-.465 0-.842-.378-.842-.843 0-.466.377-.843.842-.843.465 0 .842.377.842.843 0 .465-.377.843-.842.843z"/>
                </svg>
              </div>
              <span>Android</span>
              <span className="sub">Chrome</span>
              {isAndroid && <span className="badge">Votre appareil</span>}
            </button>

            <button
              className={`platform-btn ${isIOS ? "detected" : ""}`}
              onClick={() => setSelectedPlatform("ios")}
            >
              <div className="platform-icon ios-bg">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17.36 3 12.16 5.37 8.65c1.19-1.65 3.08-2.7 5.09-2.73 1.34-.03 2.6.9 3.42.9.82 0 2.35-1.11 3.96-.95.67.03 2.56.27 3.77 2.04-.09.06-2.25 1.31-2.23 3.92.02 3.12 2.73 4.16 2.76 4.17-.02.06-.43 1.47-1.43 2.92zM16.2 3.8c.95-1.15 1.59-2.74 1.41-4.33-1.37.06-3.02.91-4 2.06-.88.99-1.65 2.59-1.44 4.11 1.52.12 3.07-.76 4.03-1.84z"/>
                </svg>
              </div>
              <span>iOS</span>
              <span className="sub">Safari</span>
              {isIOS && <span className="badge">Votre appareil</span>}
            </button>
          </div>

          <div className="features">
            <div className="feature">
              <div className="feature-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2.2">
                  <path d="M13 2L4 14h6l-1 8 9-12h-6z" />
                </svg>
              </div>
              <span>Navigation instantanée</span>
            </div>
            <div className="feature">
              <div className="feature-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2.2">
                  <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" />
                </svg>
              </div>
              <span>Notifications exclusives</span>
            </div>
            <div className="feature">
              <div className="feature-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2.2">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </div>
              <span>Accès direct depuis l'accueil</span>
            </div>
          </div>
        </>
      )}

      {(selectedPlatform === "android" || selectedPlatform === "ios") && (
        <div className="guide-container">
          <div className="guide-header">
            <div className={`guide-icon ${selectedPlatform === "android" ? "android-bg" : "ios-bg"}`}>
              {selectedPlatform === "android" ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#3ddc84">
                  <path d="M17.523 15.3414c-.5648 0-1.0227.428-1.0227.956s.4579.956 1.0227.956c.5648 0 1.0227-.428 1.0227-.956s-.4579-.956-1.0227-.956zm-11.046 0c-.5648 0-1.0227.428-1.0227.956s.4579.956 1.0227.956c.5648 0 1.0227-.428 1.0227-.956s-.4579-.956-1.0227-.956z"/>
                  <path d="M12.002 2.003c-1.942 0-3.85.585-5.437 1.667l-1.47-1.47c-.292-.293-.767-.293-1.06 0-.293.292-.293.767 0 1.06l1.283 1.283c-1.236 1.24-2.15 2.81-2.66 4.546h18.688c-.51-1.736-1.424-3.306-2.66-4.546l1.284-1.283c.292-.293.292-.768 0-1.06-.293-.293-.768-.293-1.06 0l-1.47 1.47c-1.587-1.082-3.495-1.667-5.437-1.667zM6.088 8.928c-.465 0-.842-.378-.842-.843 0-.466.377-.843.842-.843.465 0 .842.377.842.843 0 .465-.377.843-.842.843zm11.824 0c-.465 0-.842-.378-.842-.843 0-.466.377-.843.842-.843.465 0 .842.377.842.843 0 .465-.377.843-.842.843z"/>
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17.36 3 12.16 5.37 8.65c1.19-1.65 3.08-2.7 5.09-2.73 1.34-.03 2.6.9 3.42.9.82 0 2.35-1.11 3.96-.95.67.03 2.56.27 3.77 2.04-.09.06-2.25 1.31-2.23 3.92.02 3.12 2.73 4.16 2.76 4.17-.02.06-.43 1.47-1.43 2.92zM16.2 3.8c.95-1.15 1.59-2.74 1.41-4.33-1.37.06-3.02.91-4 2.06-.88.99-1.65 2.59-1.44 4.11 1.52.12 3.07-.76 4.03-1.84z"/>
                </svg>
              )}
            </div>
            <div>
              <h2>{selectedPlatform === "android" ? "Installation Android" : "Installation iOS"}</h2>
              <p>4 étapes rapides {selectedPlatform === "ios" ? "(via Safari)" : "(via Chrome)"}</p>
            </div>
          </div>

          <div className="steps-grid">
            {(selectedPlatform === "android" ? androidSteps : iosSteps).map((step, i) => (
              <div className={`step-card ${i === 3 ? "final" : ""}`} key={i}>
                <div className="step-img-wrap">
                  <img src={step.img} alt={`Étape ${i + 1}`} />
                  <span className="step-tag">{i === 3 ? "✓" : i + 1}</span>
                </div>
                <p>{step.label}</p>
              </div>
            ))}
          </div>

          {selectedPlatform === "ios" && (
            <div className="ios-note">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e65100" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <circle cx="12" cy="16" r="0.5" fill="#e65100" />
              </svg>
              <p>Fonctionne uniquement avec Safari sur iPhone / iPad</p>
            </div>
          )}

          <div className="success-message">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12l3 3 6-6" />
            </svg>
            <p>L'icône RAMCI apparaîtra sur votre écran d'accueil après installation.</p>
          </div>
        </div>
      )}

      <style>{`
        .install-page {
          min-height: 100vh;
          background: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .install-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          border-bottom: 1px solid #f0ede8;
          position: sticky;
          top: 0;
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(10px);
          z-index: 100;
        }

        .back-btn {
          background: #f5f5f5;
          border: none;
          cursor: pointer;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          color: #111;
          transition: background 0.15s;
        }

        .back-btn:hover { background: #ebebeb; }

        .install-header h1 {
          font-size: 17px;
          font-weight: 600;
          color: #111;
          margin: 0;
        }

        .hero-section {
          text-align: center;
          padding: 36px 24px 32px;
          background: #14142b;
          color: white;
        }

        .hero-icon {
          width: 64px;
          height: 64px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }

        .hero-section h2 {
          font-size: 21px;
          font-weight: 600;
          margin: 0 0 8px;
          color: white;
        }

        .hero-section p {
          font-size: 13px;
          opacity: 0.7;
          line-height: 1.6;
          margin: 0;
        }

        .platform-buttons {
          display: flex;
          gap: 12px;
          padding: 20px 18px;
        }

        .platform-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 22px 12px;
          background: #fff;
          border: 1px solid #ececec;
          border-radius: 18px;
          cursor: pointer;
          transition: all 0.15s;
          position: relative;
        }

        .platform-btn:hover {
          border-color: #d0d0d0;
          transform: translateY(-1px);
        }

        .platform-btn.detected {
          border-color: #e53935;
          background: #fff8f7;
        }

        .platform-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
        }

        .android-bg { background: #0f1f17; }
        .ios-bg { background: #14142b; }

        .platform-btn span {
          font-size: 15px;
          font-weight: 600;
          color: #111;
        }

        .platform-btn .sub {
          font-size: 11px;
          font-weight: 400;
          color: #999;
        }

        .badge {
          position: absolute;
          top: -8px;
          right: -6px;
          background: #e53935;
          color: white;
          font-size: 10px;
          font-weight: 500;
          padding: 3px 8px;
          border-radius: 20px;
        }

        .features {
          background: #faf8f5;
          border-radius: 18px;
          margin: 4px 18px 24px;
          padding: 6px 16px;
        }

        .feature {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 0;
          border-bottom: 1px solid #f0ede8;
        }

        .feature:last-child { border-bottom: none; }

        .feature-icon {
          width: 30px;
          height: 30px;
          border-radius: 10px;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .feature span {
          font-size: 13.5px;
          color: #333;
          font-weight: 500;
        }

        .guide-container {
          padding: 18px;
        }

        .guide-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 20px;
        }

        .guide-icon {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .guide-header h2 {
          font-size: 18px;
          font-weight: 600;
          color: #111;
          margin: 0 0 2px;
        }

        .guide-header p {
          font-size: 12.5px;
          color: #999;
          margin: 0;
        }

        .steps-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .step-card {
          background: #faf8f5;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid #f0ede8;
        }

        .step-card.final {
          background: #effaf2;
          border-color: #d4ecdb;
        }

        .step-img-wrap {
          position: relative;
          aspect-ratio: 1 / 1;
          background: #fff;
          overflow: hidden;
        }

        .step-img-wrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .step-tag {
          position: absolute;
          top: 8px;
          left: 8px;
          width: 24px;
          height: 24px;
          background: #14142b;
          color: #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
        }

        .step-card.final .step-tag {
          background: #4caf50;
        }

        .step-card p {
          font-size: 12.5px;
          color: #444;
          font-weight: 500;
          margin: 0;
          padding: 10px 12px;
          line-height: 1.35;
        }

        .ios-note {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #fff3e0;
          border-radius: 14px;
          padding: 12px 14px;
          margin-top: 14px;
        }

        .ios-note p {
          font-size: 12px;
          color: #e65100;
          margin: 0;
          font-weight: 500;
        }

        .success-message {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #e8f5e9;
          border-radius: 16px;
          padding: 16px;
          margin-top: 14px;
        }

        .success-message p {
          font-size: 13px;
          font-weight: 500;
          color: #2e7d32;
          margin: 0;
          line-height: 1.4;
        }

        @media (max-width: 360px) {
          .steps-grid { gap: 8px; }
          .step-card p { font-size: 11.5px; padding: 8px 10px; }
        }
      `}</style>
    </div>
  );
};

export default InstallApp;