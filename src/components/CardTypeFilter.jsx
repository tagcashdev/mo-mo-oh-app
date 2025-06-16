import React, { useState, useEffect } from 'react';

function CardTypeFilter({ onFilterChange, currentFilter }) { // Ajout de currentFilter pour maintenir la valeur
  const [cardTypes, setCardTypes] = useState([]);
  // const [selectedType, setSelectedType] = useState(''); // Géré par App.jsx maintenant

  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const types = await window.electronAPI.getDistinctCardTypes();
        setCardTypes(types || []);
      } catch (error) {
        console.error("Erreur lors de la récupération des types de cartes:", error);
      }
    };
    fetchTypes();
  }, []);

  const handleChange = (event) => {
    const newType = event.target.value;
    // setSelectedType(newType); // Plus besoin de gérer l'état localement
    onFilterChange(newType); 
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <label htmlFor="card-type-filter" style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Type:</label>
      <select 
        id="card-type-filter" 
        value={currentFilter} // Utiliser la valeur du filtre passée par App.jsx
        onChange={handleChange} 
        style={{padding: '8px', borderRadius: '4px', border: '1px solid #ccc', flexGrow: 1, minWidth: '150px'}}
      >
        <option value="">Tous les Types</option>
        {cardTypes.map(type => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
    </div>
  );
}

export default CardTypeFilter;