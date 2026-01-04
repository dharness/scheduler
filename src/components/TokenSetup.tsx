import React, { useState } from 'react';
import './TokenSetup.css';

interface TokenSetupProps {
  onSave: (token: string) => void;
}

export const TokenSetup: React.FC<TokenSetupProps> = ({ onSave }) => {
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token.trim()) {
      setError('GitHub token is required');
      return;
    }

    setError(null);
    onSave(token.trim());
  };

  return (
    <div className="token-setup-overlay">
      <div className="token-setup-modal">
        <h2>GitHub Token Setup</h2>
        <p>Enter your GitHub Personal Access Token to get started.</p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="token">
              GitHub Personal Access Token (
              <a 
                href="https://github.com/settings/tokens?type=beta" 
                target="_blank" 
                rel="noopener noreferrer"
                className="token-link"
              >
                create one here
              </a>
              )
            </label>
            <input
              id="token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_..."
              required
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" className="save-button">
            Save
          </button>
        </form>
      </div>
    </div>
  );
};
