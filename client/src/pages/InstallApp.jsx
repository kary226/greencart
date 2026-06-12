import React from 'react';
import { useNavigate } from 'react-router-dom';

const InstallApp = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1);
  };

  return (
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

      <div className="install-content">
        {/* Le contenu viendra ici plus tard */}
      </div>

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

        .install-content {
          padding: 20px;
        }
      `}</style>
    </div>
  );
};

export default InstallApp;