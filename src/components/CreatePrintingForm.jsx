// src/components/CreatePrintingForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import './EditPrintingDetailsForm.css'; // On peut réutiliser les styles du formulaire existant

function CreatePrintingForm({ cardId, artworkInfo, onClose, onSave }) {
  // État pour les champs du formulaire
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSet, setSelectedSet] = useState(null);
  const [isCreatingNewSet, setIsCreatingNewSet] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetCode, setNewSetCode] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [rarity, setRarity] = useState('');
  const [language, setLanguage] = useState('EN');
  const [edition, setEdition] = useState('1st Edition');

  // Fonction de "debounce" pour ne pas surcharger l'IPC lors de la recherche
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
    if (!rarity || !cardNumber) {
      alert("Veuillez saisir au moins un numéro de carte et une rareté.");
      return;
    }

    let setDetails;
    if (isCreatingNewSet) {
        if (!newSetName || !newSetCode) {
            alert("Veuillez saisir le nom et le code du nouveau set.");
            return;
        }
        setDetails = { set_code: newSetCode.toUpperCase(), set_name: newSetName };
    } else if (selectedSet) {
        setDetails = { set_code: selectedSet.set_code, set_name: selectedSet.set_name };
    } else {
        alert("Veuillez sélectionner un set existant ou en créer un nouveau.");
        return;
    }
    
    // Déterminer l'ID de l'artwork alternatif s'il y a lieu
    const alternateArtworkId = artworkInfo?.alternate_artwork_db_id || null;

    onSave({
      card_id: cardId,
      ...setDetails,
      card_number_in_set: cardNumber.toUpperCase(),
      rarity: rarity,
      language: language,
      edition: edition || null, // Envoyer null si le champ est vide
      artwork_variant_id: alternateArtworkId 
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

  let cardViewStyle = {}; 

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

  return (
    <div className="edit-details-modal-overlay" onClick={onClose}>
      <div className="edit-details-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="edit-details-modal-content" style={cardViewStyle}> 
          <div className="edit-details-modal">
            <button className="close-modal-button" onClick={onClose} title="Fermer">X</button>
            <h3>Créer une nouvelle impression pour :</h3>
            <p><strong>{artworkInfo.name}</strong></p>
            <p><small>Cette nouvelle impression sera liée à l'artwork actuellement affiché.</small></p>
            
            <form onSubmit={handleSubmit} className="edit-details-form">
              <div className="form-group">
                <label htmlFor="set_search">Rechercher un Set (par nom ou code) :</label>
                <div className="search-set-container">
                    <input 
                        type="text" 
                        id="set_search"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); if(selectedSet) resetSetSelection(); setIsCreatingNewSet(false); }}
                        placeholder="Commencez à taper pour rechercher..."
                        disabled={isCreatingNewSet}
                        autoComplete="off"
                    />
                    {selectedSet && <button type="button" className="clear-selection-button" onClick={resetSetSelection}>×</button>}
                </div>
                {searchResults.length > 0 && (
                    <ul className="search-results-list">
                        {searchResults.map(set => (
                            <li key={set.id} onClick={() => handleSelectSet(set)}>
                                {set.set_name} ({set.set_code})
                            </li>
                        ))}
                    </ul>
                )}
              </div>
              
              <div className="form-group">
                <input type="checkbox" id="create-new-set" checked={isCreatingNewSet} onChange={() => {setIsCreatingNewSet(!isCreatingNewSet); resetSetSelection();}} />
                <label htmlFor="create-new-set" style={{display: 'inline-block', marginLeft: '5px'}}>...ou créer un nouveau set</label>
              </div>
              
              {isCreatingNewSet && (
                <div className="new-set-fields">
                    <input type="text" placeholder="Nom du nouveau set" value={newSetName} onChange={e => setNewSetName(e.target.value)} required={isCreatingNewSet} />
                    <input type="text" placeholder="CODE du nouveau set" value={newSetCode} onChange={e => setNewSetCode(e.target.value.toUpperCase())} required={isCreatingNewSet} />
                </div>
              )}


              <div className="form-group">
                <label htmlFor="card_number">Numéro dans le set (ex: LOB-EN001):</label>
                <input 
                  type="text" 
                  id="card_number"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value.toUpperCase())}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="rarity">Rareté :</label>
                <input 
                  type="text" 
                  id="rarity"
                  value={rarity}
                  onChange={(e) => setRarity(e.target.value)}
                  placeholder="Ex: Ultra Rare, Common..."
                  required
                />
              </div>
              <div className="form-group">
                  <label htmlFor="language">Langue :</label>
                  <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)} required>
                    <option value="EN">English</option>
                    <option value="FR">Français</option>
                    <option value="DE">Deutsch</option>
                    <option value="IT">Italiano</option>
                    <option value="SP">Español</option>
                    <option value="PT">Português</option>
                    <option value="JP">Japanese</option>
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

              <div className="form-actions">
                <button type="submit" className="save-button">Créer Impression</button>
                <button type="button" onClick={onClose} className="cancel-button">Annuler</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreatePrintingForm;