import React, { useState, useEffect, useCallback } from 'react';
import ButtonImporter from './components/ButtonImporter.jsx';
import Sidebar from './components/Sidebar.jsx';
import CardList from './components/CardList.jsx';
import CardDetailView from './components/CardDetailView.jsx';
import FilterSidebar from './components/FilterSidebar.jsx';
import './App.css';

import ExtensionPage from './pages/ExtensionPage.jsx';

function App() {
  const [displayedArtworks, setDisplayedArtworks] = useState([]);
  const [selectedArtworkInfo, setSelectedArtworkInfo] = useState(null); 
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20; 
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCardType, setSelectedCardType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState('Base de Données'); 

  const fetchArtworksForPage = useCallback(async (page, type, term) => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.getCards({ 
        page: page,
        limit: itemsPerPage,
        cardType: type,
        searchTerm: term
      });
      const artworksWithGlobalCounts = (result.cards || []).map(art => ({
        ...art,
        owned_count: art.owned_count || 0, 
        wanted_count: art.wanted_count || 0, 
        trade_count: art.trade_count || 0,   
      }));

      setDisplayedArtworks(artworksWithGlobalCounts); 
      setTotalPages(result.totalPages || 1);

      // Si une carte était sélectionnée, on met à jour ses infos
      // On utilise une fonction pour mettre à jour l'état afin d'accéder à la valeur la plus récente
      setSelectedArtworkInfo(prevSelected => {
        if (prevSelected) {
          const updatedSelected = artworksWithGlobalCounts.find(art => art.unique_artwork_display_id === prevSelected.unique_artwork_display_id);
          return updatedSelected || prevSelected; 
        }
        return null;
      });
    } catch (error) {
      console.error("Erreur lors de la récupération des artworks:", error);
      setDisplayedArtworks([]);
      setTotalPages(1);
    }
    setIsLoading(false);
  }, [itemsPerPage]);

  useEffect(() => {
    fetchArtworksForPage(currentPage, selectedCardType, searchTerm);
  }, [currentPage, selectedCardType, searchTerm, fetchArtworksForPage]);

  const handleArtworkSelect = (artworkInfo) => {
    setSelectedArtworkInfo(artworkInfo);
  };

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleCardTypeFilterChange = (newType) => {
    setSelectedCardType(newType);
    setCurrentPage(1);
  };

  const handleSearchTermChange = (event) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  const refreshData = useCallback(() => {
    // Rafraîchit la liste principale des artworks
    // Cela est utile si le owned_count global d'un artwork a changé
    fetchArtworksForPage(currentPage, selectedCardType, searchTerm);
  }, [currentPage, selectedCardType, searchTerm, fetchArtworksForPage]);

  const renderActiveView = () => {
    switch(activeView) {
      case 'Extensions':
        return <ExtensionPage />;
      case 'Base de Données':
      default:
        return (
          <div className="main-gallery-area">
            <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #ddd' }}>
              <ButtonImporter />
            </div>
            <div className="card-list-area">
              <h2 style={{marginTop: 0, marginBottom: '15px'}}>Galerie d'Artworks</h2>
            {isLoading ? (
              <p>Chargement des artworks...</p>
            ) : (
              <CardList 
                artworks={displayedArtworks} 
                onArtworkSelect={handleArtworkSelect} 
              />
            )}
            {!isLoading && totalPages > 0 && displayedArtworks.length > 0 && (
              <div className="pagination-controls">
                <button 
                  onClick={() => handlePageChange(currentPage - 1)} 
                  disabled={currentPage === 1}
                >
                  Précédent
                </button>
                <span style={{ margin: '0 10px' }}>
                  Page {currentPage} sur {totalPages}
                </span>
                <button 
                  onClick={() => handlePageChange(currentPage + 1)} 
                  disabled={currentPage === totalPages}
                >
                  Suivant
                </button>
              </div>
            )}
            {!isLoading && displayedArtworks.length === 0 && (searchTerm || selectedCardType) && (
                <p style={{textAlign: 'center', color: '#666', marginTop: '20px'}}>Aucun artwork trouvé pour les filtres actuels.</p>
            )}
            </div>
          </div>
        );
    }
  }

  return (
    <div className="app-container">
      <Sidebar activeView={activeView} setActiveView={setActiveView} /> 

      <main className="main-content-with-filters">
        {renderActiveView()}

        {activeView === 'Base de Données' && (
          <FilterSidebar
            selectedCardType={selectedCardType}
            searchTerm={searchTerm}
            onCardTypeFilterChange={handleCardTypeFilterChange}
            onSearchTermChange={handleSearchTermChange}
          />
        )}
      </main>

      {selectedArtworkInfo && (
        <div className="card-detail-modal-overlay" onClick={() => setSelectedArtworkInfo(null)}>
          <div className="card-detail-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal-button" onClick={() => setSelectedArtworkInfo(null)}>X</button>
            <CardDetailView 
              artworkInfo={selectedArtworkInfo} 
              onArtworkLinked={refreshData} // Si la liaison d'artwork affecte la galerie
              onCollectionUpdated={refreshData} // Pour rafraîchir la galerie après modif de quantité
            /> 
          </div>
        </div>
      )}
    </div>
  );
}

export default App;