import React, { useState, useEffect } from 'react';
import './EditPrintingDetailsForm.css'; 

const cardConditions = ["Mint", "Near Mint", "Excellent", "Good", "Light Played", "Played", "Poor"];

function EditPrintingDetailsForm({ printingInfo, onClose, onSave }) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchItems = async () => {
        if (printingInfo && printingInfo.printing_id) {
            setIsLoading(true);
            setError(null);
            try {
                // Ce handler IPC récupère tous les lots pour cette impression depuis la DB
                const collectionItems = await window.electronAPI.getCollectionItemsForPrinting(printingInfo.printing_id);
                setItems(collectionItems || []);
            } catch (err) {
                console.error("Erreur lors de la récupération des lots de collection:", err);
                setError("Impossible de charger les détails de la collection.");
                setItems([]);
            }
            setIsLoading(false);
        }
    };
    fetchItems();
  }, [printingInfo]);

  const handleItemChange = (id, field, value) => {
    setItems(currentItems => currentItems.map(item => {
      if (item.id === id) {
        // Pour la quantité, s'assurer que c'est un nombre
        if (field === 'quantity') {
          const numValue = parseInt(value, 10);
          return { ...item, [field]: isNaN(numValue) ? 0 : numValue };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const addNewItem = (status) => {
    const newItem = {
      id: -Date.now(), // ID temporaire unique
      card_printing_id: printingInfo.printing_id,
      collection_status: status,
      quantity: 1,
      condition: '',
      storage_location: '',
      acquisition_date: '',
      acquisition_price: '',
      user_notes: ''
    };
    setItems(currentItems => [...currentItems, newItem]);
  };

  const handleRemoveItem = (id) => {
    // Marquer pour suppression si c'est un item existant, sinon le retirer de l'état
    setItems(currentItems => 
      currentItems.map(item => item.id === id ? { ...item, _to_delete: true } : item)
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      printingId: printingInfo.printing_id, // Envoyer avec 'printingId' (camelCase)
      items: items // 'items' est le tableau complet géré par l'état local
    });
  };

  if (isLoading) {
    return (
        <div className="edit-details-modal-overlay" onClick={onClose}>
            <div className="edit-details-modal-content" onClick={(e) => e.stopPropagation()}>
                <p>Chargement des détails de la collection...</p>
            </div>
        </div>
    );
  }

  const renderItemGroup = (status) => {
    const filteredItems = items.filter(item => item.collection_status === status && !item._to_delete);
    const canEditDetails = status === 'Owned' ||  status === 'Trade';
    const sectionStyle = {};

    if (status == 'Owned') { sectionStyle.backgroundColor = 'rgb(98, 164, 81)'; }
    if (status == 'Wanted') { sectionStyle.backgroundColor = 'rgb(216, 88, 63)'; }
    if (status == 'Trade') { sectionStyle.backgroundColor = 'rgb(155, 68, 149)'; }
    
    return (
        <div className="form-group-section" style={sectionStyle}>
          <h4>{status} <span type="button" onClick={() => addNewItem(status)} className="add-item-button">+</span></h4>
          <div className='form-rows'>
            {filteredItems.map(item => (
              
                <div key={item.id} className="form-row">
                    <input style={{width:'66px'}} type="number" value={item.quantity || 1} onChange={e => handleItemChange(item.id, 'quantity', e.target.value)} min="1"/>

                    <select style={{width:'166px', minWidth:'166px'}} value={item.condition || ''} onChange={e => handleItemChange(item.id, 'condition', e.target.value)}>
                        <option value="">Non spécifiée</option>
                        {cardConditions.map(cond => <option key={cond} value={cond}>{cond}</option>)}
                    </select>
          
                    {canEditDetails && (
                      <input type="text" value={item.storage_location || ''} onChange={e => handleItemChange(item.id, 'storage_location', e.target.value)} placeholder="Ex: Classeur 1"/>
                    )}
                    {canEditDetails && (
                      <input type="date" value={item.acquisition_date || ''} onChange={e => handleItemChange(item.id, 'acquisition_date', e.target.value)} />
                    )}
                    <input type="text" value={item.user_notes || ''} onChange={e => handleItemChange(item.id, 'user_notes', e.target.value)} placeholder="Notes..."/>
                    <button type="button" onClick={() => handleRemoveItem(item.id)} className="remove-item-button" title="Supprimer ce lot">×</button>
                </div>
             
            ))}
          </div>
        </div>
    );
  };

  let cardViewStyle = {}; 
  const type = printingInfo.card_type ? printingInfo.card_type.toLowerCase() : '';
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
            <h3><strong>{printingInfo.card_name}</strong></h3>
            <h4>{printingInfo.set_name} - {printingInfo.rarity}</h4>
            
            <form onSubmit={handleSubmit} className="edit-details-form">
              {renderItemGroup('Owned')}
              {renderItemGroup('Wanted')}
              {renderItemGroup('Trade')}
              
              <div className="form-actions">
                <button type="submit" className="save-button">Sauvegarder les Changements</button>
                <button type="button" onClick={onClose} className="cancel-button">Annuler</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditPrintingDetailsForm;