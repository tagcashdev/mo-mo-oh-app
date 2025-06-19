function DatabasePage() {
  
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

export default DatabasePage;