import React, { useState } from 'react';
import './CardThumbnail.css';

function CardThumbnail({ artworkInfo, onCardClick }) { 
  if (!artworkInfo || typeof artworkInfo !== 'object') {
    console.error('CardThumbnail a reçu artworkInfo invalide:', artworkInfo);
    return (
      <div className="card-thumbnail card-thumbnail-error">
        <div className="card-thumbnail-placeholder">Erreur Donnée</div>
      </div>
    );
  }

  const [imageError, setImageError] = useState(false);

  // Assurez-vous que artwork_path est correctement normalisé si nécessaire
  const { artwork_path, name, owned_count, wanted_count, trade_count } = artworkInfo; 

  const getImagePath = (relativePath) => {
    if (!relativePath || imageError) return null;
    return `appimg://${relativePath.replace(/\\/g, '/')}`; // Normalise les slashes
  };

  const handleImageError = () => {
    console.warn(`Erreur de chargement pour l'image (thumbnail) : appimg://${artwork_path}`);
    setImageError(true);
  };

  const imageToDisplay = getImagePath(artwork_path); 

  return (
    <div className="card-thumbnail" onClick={onCardClick} title={`Afficher ${name}`}>
      <div className="card-thumbnail-image-container">
        {imageToDisplay ? (
          <img
            src={imageToDisplay}
            alt={name} 
            onError={handleImageError}
          />
        ) : (
          <div className="card-thumbnail-placeholder">
            {name ? 'Pas d\'image' : ''}
          </div>
        )}
      </div>
           
      <div className="card-thumbnail-counters"> {/* Conteneur pour les compteurs */}
        <span className={`count-tag owned ${owned_count > 0 ? '' : 'zero'}`}>{owned_count || 0}</span>
        <span className={`count-tag wanted ${wanted_count > 0 ? '' : 'zero'}`}>{wanted_count || 0}</span>
        <span className={`count-tag trade ${trade_count > 0 ? '' : 'zero'}`}>{trade_count || 0}</span>
      </div>
    </div>
  );
}

export default CardThumbnail;