import React from 'react';
import CardTypeFilter from './CardTypeFilter.jsx';
import './FilterSidebar.css'; // Créez ce fichier CSS

function FilterSidebar({ selectedCardType, searchTerm, onCardTypeFilterChange, onSearchTermChange }) {
  return (
    <aside className="filter-sidebar">
      <div className="filter-sidebar-header">
        <h4>Filtres & Recherche</h4>
      </div>
      <div className="filter-section">
        <CardTypeFilter 
          onFilterChange={onCardTypeFilterChange} 
          currentFilter={selectedCardType}
        />
      </div>
      <div className="filter-section">
        <label htmlFor="search-term-input" style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
          Rechercher par Nom:
        </label>
        <input
          type="text"
          id="search-term-input"
          value={searchTerm}
          onChange={onSearchTermChange} // Utiliser la prop correcte
          placeholder="Nom de la carte..."
          style={{padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: 'calc(100% - 18px)' /* Ajuster pour le padding */}}
        />
      </div>
      {/* Vous ajouterez d'autres filtres ici */}
      {/* <div className="filter-section">
          <label>Attribut:</label>
          <select>...</select>
        </div>
        <div className="filter-section">
          <label>Niveau/Rang:</label>
          <input type="number" placeholder="Min" />
          <input type="number" placeholder="Max" />
        </div>
      */}
    </aside>
  );
}

export default FilterSidebar;