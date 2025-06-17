// src/components/EditPrintingForm.jsx
// NOUVEAU FICHIER

import React, { useState, useEffect, useCallback } from 'react';
// Réutilisation des styles
import './EditPrintingDetailsForm.css'; 

function EditPrintingForm({ printingInfo, onClose, onSave }) {
  // --- États pré-remplis avec les informations de l'impression ---
  const [searchTerm, setSearchTerm] = useState(`${printingInfo.set_name} (${printingInfo.set_code})`);
  const [selectedSet, setSelectedSet] = useState({ id: printingInfo.set_id, set_code: printingInfo.set_code, set_name: printingInfo.set_name });
  const [cardNumber, setCardNumber] = useState(printingInfo.card_number_in_set);
  const [rarity, setRarity] = useState(printingInfo.rarity);
  const [language, setLanguage] = useState(printingInfo.language);
  const [edition, setEdition] = useState(printingInfo.edition || '');
  const [alternateArtworks, setAlternateArtworks] = useState([]);
  const [selectedArtworkId, setSelectedArtworkId] = useState(printingInfo.artwork_variant_id || '');
  
  const [searchResults, setSearchResults] = useState([]);
  
  // Récupérer les artworks alternatifs pour le menu déroulant
  useEffect(() => {
    const fetchAltArtworks = async () => {
        const results = await window.electronAPI.getAlternateArtworksForCard(printingInfo.card_id);
        setAlternateArtworks(results || []);
    };
    fetchAltArtworks();
  }, [printingInfo.card_id]);

  const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), delay);
    };
  };

  const debouncedSearch = useCallback(debounce(async (query) => {
    if (query.length > 1) {
      const results = await window.electronAPI.searchSets(query);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, 300), []);

  useEffect(() => {
    if(!selectedSet) {
        debouncedSearch(searchTerm);
    }
  }, [searchTerm, selectedSet, debouncedSearch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!rarity || !cardNumber || !selectedSet) {
      alert("Veuillez vérifier que le set, le numéro de carte et la rareté sont bien saisis.");
      return;
    }

    onSave({
      printing_id: printingInfo.printing_id, // Important: inclure l'ID de l'impression
      set_id: selectedSet.id,
      card_number_in_set: cardNumber.toUpperCase(),
      rarity: rarity,
      language: language,
      edition: edition || null,
      artwork_variant_id: selectedArtworkId === '' ? null : Number(selectedArtworkId),
    });
  };

  const handleSelectSet = (set) => {
      setSelectedSet(set);
      setSearchTerm(`${set.set_name} (${set.set_code})`);
      setSearchResults([]);
  }

  const resetSetSelection = () => {
      setSelectedSet(null);
      setSearchTerm('');
  }
  
  // Logique de style existante
  let cardViewStyle = {}; 
  const type = printingInfo.card_type ? printingInfo.card_type.toLowerCase() : '';
  if (type.includes('normal monster')) cardViewStyle.backgroundColor = 'rgba(253, 230, 138, 0.6)';
  else if (type.includes('effect monster') || type.includes('flip') || type.includes('tuner') || type.includes('gemini') || type.includes('union') || type.includes('spirit')) cardViewStyle.backgroundColor = 'rgba(255, 187, 109, 0.6)';
  else if (type.includes('ritual')) cardViewStyle.backgroundColor = 'rgba(160, 196, 255, 0.6)';
  else if (type.includes('fusion')) cardViewStyle.backgroundColor = 'rgba(167, 139, 250, 0.6)';
  else if (type.includes('synchro')) cardViewStyle.backgroundColor = 'rgba(229, 231, 235, 0.8)';
  else if (type.includes('xyz')) { cardViewStyle.backgroundColor = 'rgba(55, 65, 81, 0.8)'; cardViewStyle.color = '#fff';}
  else if (type.includes('link')) { cardViewStyle.backgroundColor = 'rgba(59, 130, 246, 0.7)'; cardViewStyle.color = '#fff';}
  else if (type.includes('spell')) cardViewStyle.backgroundColor = 'rgba(167, 243, 208, 0.6)';
  else if (type.includes('trap')) cardViewStyle.backgroundColor = 'rgba(249, 168, 212, 0.6)';
  else if (type.includes('skill')) cardViewStyle.backgroundColor = 'rgba(103, 232, 249, 0.6)';

  return (
    <div className="edit-details-modal-overlay" onClick={onClose}>
      <div className="edit-details-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="edit-details-modal-content" style={cardViewStyle}> 
          <div className="edit-details-modal">
            <button className="close-modal-button" onClick={onClose} title="Fermer">X</button>
            <h3>Éditer l'impression pour :</h3>
            <p><strong>{printingInfo.card_name}</strong></p>
            
            <form onSubmit={handleSubmit} className="edit-details-form">
                <div className="form-group">
                    <label htmlFor="set_search">Set :</label>
                    <div className="search-set-container">
                        <input 
                            type="text" id="set_search" value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); if(selectedSet) resetSetSelection(); }}
                            placeholder="Rechercher un set..."
                            autoComplete="off"
                        />
                        {selectedSet && <button type="button" className="clear-selection-button" onClick={resetSetSelection}>×</button>}
                    </div>
                    {searchResults.length > 0 && (
                        <ul className="search-results-list">{searchResults.map(set => (<li key={set.id} onClick={() => handleSelectSet(set)}>{set.set_name} ({set.set_code})</li>))}</ul>
                    )}
                </div>

                <div className="form-group">
                    <label htmlFor="card_number">Numéro dans le set :</label>
                    <input type="text" id="card_number" value={cardNumber} onChange={(e) => setCardNumber(e.target.value.toUpperCase())} required />
                </div>
                
                <div className="form-group">
                    <label htmlFor="rarity">Rareté :</label>
                    <input type="text" id="rarity" value={rarity} onChange={(e) => setRarity(e.target.value)} required />
                </div>

                <div className="form-group">
                    <label htmlFor="language">Langue :</label>
                    <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)} required>
                        <option value="EN">English</option>
                        <option value="FR">Français</option>
                        {/* ... autres langues ... */}
                    </select>
                </div>
                
                <div className="form-group">
                    <label htmlFor="edition">Édition :</label>
                    <select id="edition" value={edition} onChange={(e) => setEdition(e.target.value)}>
                        <option value="1st Edition">1st Edition</option>
                        <option value="Limited Edition">Limited Edition</option>
                        <option value="">Unlimited</option>
                    </select>
                </div>

                {/*
                <div className="form-group">
                    <label htmlFor="artwork_variant_id">Artwork :</label>
                    <select id="artwork_variant_id" value={selectedArtworkId} onChange={(e) => setSelectedArtworkId(e.target.value)}>
                        <option value="">Artwork Principal</option>
                        {alternateArtworks.map(art => (
                            <option key={art.id} value={art.id}>{art.artwork_name}</option>
                        ))}
                    </select>
                </div>
                */}

                <div className="form-actions">
                    <button type="submit" className="save-button">Mettre à Jour</button>
                    <button type="button" onClick={onClose} className="cancel-button">Annuler</button>
                </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditPrintingForm;