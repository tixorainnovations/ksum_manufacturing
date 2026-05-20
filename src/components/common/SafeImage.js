import React, { useState } from 'react';

const SafeImage = ({ src, alt, className, style, fallbackIcon = '📷', fallbackText = 'No Media' }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  if (!src || hasError) {
    return (
      <div 
        className={`fallback-image ${className || ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f1f5f9',
          color: '#94a3b8',
          border: '1px dashed #cbd5e1',
          borderRadius: '4px',
          padding: '1rem',
          ...style
        }}
      >
        <span style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{fallbackIcon}</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{fallbackText}</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', ...style }} className={className}>
      {!isLoaded && (
        <div 
          style={{ 
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
            background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' 
          }}
        >
           <span className="spinner" style={{ fontSize: '1.2rem', animation: 'spin 1s linear infinite' }}>⏳</span>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.3s ease',
          display: 'block'
        }}
      />
      <style>{`
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SafeImage;
