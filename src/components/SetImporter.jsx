// src/components/SetImporter.jsx

import React, { useState } from 'react';

function SetImporter() {
  const [importStatus, setImportStatus] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleImportData = async () => {
    setIsImporting(true);
    setImportStatus("Lancement de l'importation des sets et impressions...");
    try {
      const result = await window.electronAPI.importAllSetsAndPrintings();
      setImportStatus(result.message);
    } catch (error) {
      setImportStatus(`Erreur lors du lancement de l'importation: ${error.message}`);
      console.error("Erreur d'importation (côté renderer):", error);
    } finally {
        // On pourrait utiliser la progression pour remettre à false, 
        // mais pour l'instant un simple reset est suffisant.
        setIsImporting(false); 
    }
  };

  return (
    <div style={{ border: '1px solid #3c3c3c', padding: '20px', margin: '20px', borderRadius: '8px', backgroundColor: '#2a2e37' }}>
      <h2><span role="img" aria-label="box icon">📦</span> Import Sets & Printings</h2>
      <button 
        onClick={handleImportData} 
        disabled={isImporting} 
        style={{padding: '10px 15px', background: 'rgba(255, 255, 255, 0.4)', fontSize: '16px', cursor: isImporting ? 'not-allowed' : 'pointer'}}
      >
        {isImporting ? 'Importation en cours...' : 'Importer tous les Sets & Impressions'}
      </button>
      <p style={{marginTop: '10px', fontStyle: 'italic', color: '#ccc'}}>
        Note: Ce processus peut être très long. Il va vérifier chaque set de l'API et importer les impressions manquantes pour les cartes que vous avez déjà dans votre base de données.
      </p>
      {importStatus && <p style={{marginTop: '15px'}}><strong>Statut:</strong> {importStatus}</p>}
    </div>
  );
}

export default SetImporter;