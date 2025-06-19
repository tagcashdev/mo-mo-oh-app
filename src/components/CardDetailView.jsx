import React, { useState, useEffect } from 'react';
import CardDisplay from './CardDisplay.jsx';
import EditPrintingDetailsForm from './EditPrintingDetailsForm.jsx';
import CreatePrintingForm from './CreatePrintingForm.jsx';
import EditPrintingForm from './EditPrintingForm.jsx'; 
import './CardDetailView.css';

function CardDetailView({ artworkInfo, onCollectionUpdated }) { 
  const [allPrintingsForCard, setAllPrintingsForCard] = useState([]);
  const [isLoadingPrintings, setIsLoadingPrintings] = useState(false);
  const [showAll, setShowAll] = useState(false); 
  const [editingPrintingInfo, setEditingPrintingInfo] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [linkStatus, setLinkStatus] = useState({}); 
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [printingToEdit, setPrintingToEdit] = useState(null);
  const [isEditPrintingModalOpen, setIsEditPrintingModalOpen] = useState(false);

  const fetchPrintings = async () => {
    if (artworkInfo && artworkInfo.card_id) {
      setLinkStatus({}); 
      setIsLoadingPrintings(true);
      try {
        const fetchedPrintings = await window.electronAPI.getPrintingsForCardDetails(artworkInfo.card_id);
        setAllPrintingsForCard(fetchedPrintings);
      } catch (error) {
        console.error("Erreur lors de la récupération des impressions pour la vue détaillée:", error);
        setAllPrintingsForCard([]);
      }
      setIsLoadingPrintings(false);
    } else {
      setAllPrintingsForCard([]);
    }
  };

  useEffect(() => {
    fetchPrintings();
    setShowAll(false); 
  }, [artworkInfo]); 

  if (!artworkInfo) {
    return null; 
  }

  let cardViewStyle = {}; 
  let actualArtwork = {};
  const type = artworkInfo.card_type ? artworkInfo.card_type.toLowerCase() : '';
  if (type.includes('normal monster')) cardViewStyle.backgroundColor = 'rgba(253, 230, 138, 0.6)'; // Semi-transparent
  else if (type.includes('effect monster') || type.includes('flip') || type.includes('tuner') || type.includes('gemini') || type.includes('union') || type.includes('spirit')) cardViewStyle.backgroundColor = 'rgba(255, 187, 109, 0.6)';
  else if (type.includes('ritual')) cardViewStyle.backgroundColor = 'rgba(160, 196, 255, 0.6)';
  else if (type.includes('fusion')) cardViewStyle.backgroundColor = 'rgba(167, 139, 250, 0.6)';
  else if (type.includes('synchro')) cardViewStyle.backgroundColor = 'rgba(229, 231, 235, 0.8)';
  else if (type.includes('xyz')) { cardViewStyle.backgroundColor = 'rgba(55, 65, 81, 0.8)'; cardViewStyle.color = '#fff';}
  else if (type.includes('link')) { cardViewStyle.backgroundColor = 'rgba(59, 130, 246, 0.7)'; cardViewStyle.color = '#fff';}
  else if (type.includes('spell')) cardViewStyle.backgroundColor = 'rgba(167, 243, 208, 0.6)';
  else if (type.includes('trap')) cardViewStyle.backgroundColor = 'rgba(249, 168, 212, 0.6)';
  else if (type.includes('skill')) cardViewStyle.backgroundColor = 'rgba(103, 232, 249, 0.6)';

  if (type.includes('pendulum') && type.includes('monster')) {
    const monsterBgColor = cardViewStyle.backgroundColor || 'rgba(255, 187, 109, 0.6)'; // Default effect monster color
    const spellBgColor = 'rgba(167, 243, 208, 0.6)'; // Spell color
    cardViewStyle.backgroundImage = `linear-gradient(to bottom, ${monsterBgColor} 35%, ${spellBgColor} 75%)`;
  }

  const cardDataForDisplay = {
    ...artworkInfo,
    main_artwork_path: artworkInfo.artwork_path,
  };

  const displayedPrintings = showAll 
    ? allPrintingsForCard 
    : allPrintingsForCard.filter(p => p.artwork_path === artworkInfo.artwork_path);

  const openEditModal = (printing) => {
    setEditingPrintingInfo( printing );
    setIsEditModalOpen(true);
  };
  
  const handleSaveDetails = async (detailsToSave) => {
    // Appel IPC pour sauvegarder toutes les modifications d'un coup
    // Cet handler IPC sera plus complexe.
    console.log('Données envoyées à savePrintingCollectionDetails:', detailsToSave);
    try {
       const result = await window.electronAPI.savePrintingCollectionDetails(detailsToSave);
      if(result.success) {
        setIsEditModalOpen(false);
        setEditingPrintingInfo(null);
        fetchPrintings(); // Re-fetch les impressions pour cette carte
        if (onCollectionUpdated) onCollectionUpdated(); // Re-fetch la galerie principale
      } else {
        alert(`Erreur lors de la sauvegarde: ${result.message}`);
      }
    } catch(error) {
        alert(`Erreur: ${error.message}`);
    }
  };

 const handleCreatePrinting = async (newPrintingData) => {
    try {
      // Assurez-vous que l'IPC handler 'create-card-printing' existe dans main.cjs
      const result = await window.electronAPI.createCardPrinting(newPrintingData);
      if(result.success) {
        setIsCreateModalOpen(false); // Fermer la modale
        fetchPrintings(); // Rafraîchir la liste des impressions pour voir la nouvelle
      } else {
        alert(`Erreur lors de la création de l'impression: ${result.message}`);
      }
    } catch (error) {
        alert(`Erreur: ${error.message}`);
    }
  };

  const handleLinkSpecificPrinting = async (printingIdToLink, alternateIdToLink = null) => {
    // ... (Logique de handleLinkSpecificPrinting, inchangée pour l'instant)
    if (!artworkInfo || !artworkInfo.card_id) return;
    setLinkStatus(prev => ({...prev, [printingIdToLink]: 'Liaison...' }));
    let targetAlternateId = null; 
    if (alternateIdToLink === 0) {
        targetAlternateId = null; 
    } else if (artworkInfo.unique_artwork_display_id && artworkInfo.unique_artwork_display_id.startsWith('alt_')) {
      const parts = artworkInfo.unique_artwork_display_id.split('_');
      if (parts.length === 3) { 
        const parsedId = parseInt(parts[2], 10);
        if (!isNaN(parsedId)) {
            targetAlternateId = parsedId; 
        } else {
            setLinkStatus(prev => ({...prev, [printingIdToLink]: 'Erreur: ID art invalide.' }));
            return;
        }
      } else {
        setLinkStatus(prev => ({...prev, [printingIdToLink]: 'Erreur: Format ID art.' }));
        return;
      }
    } else if (artworkInfo.unique_artwork_display_id && artworkInfo.unique_artwork_display_id.startsWith('main_')) {
        targetAlternateId = null; 
    }
    try {
      const result = await window.electronAPI.updatePrintingArtworkLink({
        printingId: printingIdToLink,
        targetAlternateArtworkId: targetAlternateId 
      });
      setLinkStatus(prev => ({...prev, [printingIdToLink]: result.success ? 'Lié!' : `Échec: ${result.message}`}));
      if(result.success) {
        fetchPrintings(); 
        if(onArtworkLinked) onArtworkLinked(); 
      }
    } catch (error) {
      console.error("Erreur lors de la liaison de l'impression:", error);
      setLinkStatus(prev => ({...prev, [printingIdToLink]: `Erreur: ${error.message}`}));
    }
  };

  const handleOpenEditPrintingModal = (printing) => {
    setPrintingToEdit(printing);
    setIsEditPrintingModalOpen(true);
  };

  const handleUpdatePrinting = async (updatedPrintingData) => {
    try {
      const result = await window.electronAPI.updateCardPrinting(updatedPrintingData);
      if (result.success) {
        setIsEditPrintingModalOpen(false);
        fetchPrintings(); // Rafraîchir la liste
      } else {
        alert(`Erreur lors de la mise à jour: ${result.message}`);
      }
    } catch (error) {
      alert(`Erreur: ${error.message}`);
    }
  };

  const handleDeletePrinting = async (printingId, printingName) => {
    const confirmation = window.confirm(`Êtes-vous sûr de vouloir supprimer l'impression "${printingName}" ? Cette action est irréversible et supprimera également les cartes de votre collection liées à cette impression.`);
    if (confirmation) {
      try {
        const result = await window.electronAPI.deleteCardPrinting(printingId);
        if (result.success) {
          fetchPrintings(); // Rafraîchir la liste
          if (onCollectionUpdated) onCollectionUpdated(); // Rafraichir la galerie si le total change
        } else {
          alert(`Erreur lors de la suppression: ${result.message}`);
        }
      } catch (error) {
        alert(`Erreur: ${error.message}`);
      }
    }
  };

  return (
    <div className="card-detail-content" style={cardViewStyle}> 
      <CardDisplay card={cardDataForDisplay} /> 

      <div className="printings-list-section">
        <div className="printings-list-header">
          <h4><span onClick={() => setShowAll(!showAll)} className="toggle-printings-button">
            {showAll ? "-" : `☰`}
          </span> {showAll ? `All printings "${artworkInfo.name}"` : `Printings for "${artworkInfo.name}" Artwork`} 
          <span onClick={() => setIsCreateModalOpen(true)} className="create-printing-button" title="Add new printing for this card">+</span>
          </h4>
        </div>
        {isLoadingPrintings ? (
          <p>Chargement des impressions...</p>
        ) : displayedPrintings.length > 0 ? (
          <div className="printings-list"> 
            {displayedPrintings.map(p => (
              <div key={p.printing_id} className='printing-item-container' style={{backgroundColor: p.artwork_path !== artworkInfo.artwork_path ? '' : 'rgba(255, 255, 255, 0.15)'}}> 
                <div className='printing-link-column'>
                  {p.artwork_path !== artworkInfo.artwork_path && (
                  <span onClick={() => handleLinkSpecificPrinting(p.printing_id)} 
                        className="link-specific-button"
                        title="Lier cette impression à l'artwork actuellement visualisé."
                        disabled={linkStatus[p.printing_id] === 'Liaison...'}>
                        🔗
                  </span>
                  )}
                  {p.artwork_variant_id !== null && artworkInfo.unique_artwork_display_id && !artworkInfo.unique_artwork_display_id.startsWith('main_') && p.artwork_path === artworkInfo.artwork_path && (
                  <span onClick={() => handleLinkSpecificPrinting(p.printing_id, 0)} 
                        className="link-specific-button"
                        title="Délier cette impression de cet artwork alternatif (utilisera l'artwork principal par défaut)."
                        disabled={linkStatus[p.printing_id] === 'Liaison...'}>
                        💥
                  </span>
                  )}
                </div>
                <div className="printing-item">
                  <div className="printing-info">
                    <span className="set-name">{p.set_name} ({p.card_number_in_set})</span>
                    <span className="rarity-details">{p.rarity} - {p.language} {p.edition && `(${p.edition})`}</span>
                  </div>
                  <div className="printing-collection-controls">
                    <div className="card-thumbnail-counters"> 
                      <span className="count-tag owned">{p.owned_count_for_this_printing || 0}</span>
                      <span className="count-tag wanted">{p.wanted_count_for_this_printing || 0}</span>
                      <span className="count-tag trade">{p.trade_count_for_this_printing || 0}</span>
                    </div>
                    <button onClick={() => openEditModal(p)} className="edit-collection-button" title="Modifier la collection pour cette impression">
                        <span className="edit-icon"> ✏️</span>
                    </button>

                  </div>
                </div>
                <div className="printing-action-column">
                    <button onClick={() => handleOpenEditPrintingModal(p)} className="printing-action-button edit" title="Éditer les informations de cette impression (set, rareté...)">
                      ⚙️
                    </button>
                    <button onClick={() => handleDeletePrinting(p.printing_id, `${p.set_name} - ${p.card_number_in_set}`)} className="printing-action-button delete" title="Supprimer définitivement cette impression">
                      🗑️
                    </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>Aucune impression spécifique trouvée pour {showAll ? "cette carte" : "cet artwork"}.</p>
        )}
        </div>  
      {isEditModalOpen && editingPrintingInfo && (
        <EditPrintingDetailsForm 
          key={`edit-${editingPrintingInfo.printing_id}`} 
          printingInfo={editingPrintingInfo}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSaveDetails}
        />
      )}

      {isCreateModalOpen && (
        <CreatePrintingForm 
          cardId={artworkInfo.card_id}
          artworkInfo={artworkInfo} // Pour pré-lier l'artwork
          onClose={() => setIsCreateModalOpen(false)}
          onSave={handleCreatePrinting}
        />
      )}

      {isEditPrintingModalOpen && printingToEdit && (
        <EditPrintingForm
          key={`edit-printing-${printingToEdit.printing_id}`}
          printingInfo={printingToEdit}
          onClose={() => setIsEditPrintingModalOpen(false)}
          onSave={handleUpdatePrinting}
        />
      )}
    </div>
  );
}
export default CardDetailView;