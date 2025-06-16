import React from 'react';
import CardThumbnail from './CardThumbnail.jsx';
import './CardList.css';

function CardList({ artworks, onArtworkSelect }) { 
  if (!artworks ) {
    return <p style={{textAlign: 'center', color: '#666', marginTop: '30px'}}>Chargement ou aucun artwork à afficher...</p>;
  }
  if (artworks.length === 0) {
    return null; // Géré par App.jsx
  }

  return (
    <div className="card-grid-container">
      {artworks
        .filter(artwork => artwork && typeof artwork === 'object' && artwork.unique_artwork_display_id) 
        .map((artwork) => (
        <CardThumbnail
          key={artwork.unique_artwork_display_id} // Clé unique pour chaque artwork
          artworkInfo={artwork} 
          onCardClick={() => onArtworkSelect(artwork)} 
        />
      ))}
    </div>
  );
}

export default CardList;