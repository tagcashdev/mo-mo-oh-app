import React, { useState } from 'react';
import './CardDisplay.css';

// isThumbnail n'est plus nécessaire ici car CardThumbnail gère les miniatures.
// CardDisplay est maintenant seulement pour la vue détaillée.
function CardDisplay({ card, onCollectionUpdated }) { 
  const [imageError, setImageError] = useState(false);

  const getImagePath = (relativePath) => {
    if (!relativePath || imageError) return null;
    return `appimg://${relativePath.replace(/\\/g, '/')}`; // Utilisez le protocole personnalisé
  };

  const handleImageError = () => {
    console.warn(`Erreur de chargement pour l'image : appimg://${card.main_artwork_path}`);
    setImageError(true);
  };

  // card.main_artwork_path est maintenant l'artwork_path spécifique passé par CardDetailView
  const imageToDisplay = getImagePath(card.main_artwork_path);

  let cardStyle = {
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'row', 
    alignItems: 'flex-start',    
  };

  const type = card.card_type ? card.card_type.toLowerCase() : '';

  const imageSize = '220px';
  const minImageHeight = '320px'; 

  return (
    <div style={cardStyle} className={'card-detail-item'}>
      <div style={{ 
          width: imageSize, 
          height: 'auto',
          minHeight: minImageHeight,
          marginBottom: '15px',
          marginRight: '20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: '4px',
          backgroundColor: '#f0f0f0',
          zIndex: '9'
      }}>
        {imageToDisplay ? (
          <img
            src={imageToDisplay}
            alt={`Artwork de ${card.name}`}
            style={{ 
              maxWidth: '100%', 
              maxHeight: '100%',
              width: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
            onError={handleImageError}
          />
        ) : (
          <div style={{fontSize: '12px', textAlign: 'center', color: '#777', height: minImageHeight, display: 'flex', alignItems:'center', justifyContent:'center'}}>
            {card.name ? 'Image non trouvée' : 'Pas d\'image'}
          </div>
        )}
      </div>

       <div style={{ flex: 1, width: '100%', zIndex: '9'}}>
          <h3 style={{ marginTop: 0, marginBottom: '5px', fontSize: '1.4em', textAlign: 'center' }}>{card.name}</h3>
          {card.french_name && card.french_name !== 'N/A' && <p style={{ fontStyle: 'italic', margin: '0 0 8px 0', fontSize: '1em', color: cardStyle.color === '#fff' ? '#cbd5e1' : '#555', textAlign: 'center' }}>{card.french_name}</p>}
          
          <hr style={{border: 0, borderTop: `1px solid ${cardStyle.color === '#fff' ? '#666' : '#ddd'}`, margin: '10px 0'}}/>

          <div className="card-info-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '6px'}}>
            <p style={{ margin: '0 0 5px 0', fontSize: '0.9em' }}><strong>Type:</strong> {card.card_type}</p>
            {card.attribute && (<p style={{ margin: '0 0 5px 0', fontSize: '0.9em' }}><strong>Attribut:</strong> {card.attribute}</p>)}
            {card.monster_race && (<p style={{ margin: '0 0 5px 0', fontSize: '0.9em' }}><strong>Race:</strong> {card.monster_race}</p>)}
            {(card.level_rank_linkval !== null && card.level_rank_linkval !== undefined) && (
              <p style={{ margin: '0 0 5px 0', fontSize: '0.9em' }}>
                <strong>{type.includes('link monster') ? 'Link': (type.includes('xyz monster') ? 'Rank' : 'Level')}:</strong> {card.level_rank_linkval} ★
                {/*!(type.includes('link monster')) && Array(Number(card.level_rank_linkval) || 0).fill(0).map((_, i) => <span key={i} style={{color: type.includes('xyz monster') ? (cardStyle.color === '#fff' ? '#fff' : 'black') : '#FBBF24', fontSize: '1.2em', marginRight: '1px' }}>★</span>)*/}
              </p>
            )}
            {(card.atk !== null && card.atk !== undefined) && <p style={{ margin: '0 0 5px 0', fontSize: '0.9em' }}><strong>ATK:</strong> {card.atk === -1 ? '?' : card.atk}</p>}
            {(card.def !== null && card.def !== undefined && !type.includes('link monster')) && <p style={{ margin: '0 0 5px 0', fontSize: '0.9em' }}><strong>DEF:</strong> {card.def === -1 ? '?' : card.def}</p>}
            {(card.scale !== null && card.scale !== undefined) && <p style={{ margin: '0 0 5px 0', fontSize: '0.9em' }}><strong>Échelle P.:</strong> {card.scale}</p>}
        </div>

          
          <hr style={{border: 0, borderTop: `1px solid ${cardStyle.color === '#fff' ? '#666' : '#ddd'}`, margin: '10px 0'}}/>

          {/* Utilisation des compteurs globaux de la carte (artworkInfo) pour cette section */}
          <div style={{marginBottom: '0', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'space-between'}}>
            {(card.owned_count !== undefined && card.owned_count > 0) && (<p className="detail-count-tag owned">Owned: <span>x{card.owned_count}</span></p>)}
            {(card.wanted_count !== undefined && card.wanted_count > 0) && (<p className="detail-count-tag wanted">Wanted : <span>x{card.wanted_count}</span></p>)}
            {(card.trade_count !== undefined && card.trade_count > 0) && (<p className="detail-count-tag trade">To Trade : <span>x{card.trade_count}</span></p>)}
          </div>


          {card.description_text && (
            <div style={{ 
              marginTop: '10px', 
              fontSize: '0.9em', 
              whiteSpace: 'pre-wrap', 
              borderTop: `1px solid ${cardStyle.color === '#fff' ? '#666' : '#eee'}`, 
              paddingTop: '8px', 
              overflowY: 'auto', 
              maxHeight: '200px', 
              textAlign: 'left'
            }}>
              <p style={{ margin: 0 }}>{card.description_text}</p>
            </div>
          )}
      </div>
    </div>
  );
}
export default CardDisplay;