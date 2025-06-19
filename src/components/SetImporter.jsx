// src/components/SetImporter.jsx

import React, { useState, useEffect, useCallback } from 'react';

// NOUVEAU: Le composant accepte une prop "onImportComplete"
function SetImporter({ onImportComplete }) {
  const [importStatus, setImportStatus] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  
  // NOUVEAUX ÉTATS POUR LA BARRE DE CHARGEMENT
  const [progressMessage, setProgressMessage] = useState('');
  const [currentProgress, setCurrentProgress] = useState(0);
  const [totalProgress, setTotalProgress] = useState(0);

  // Écouter les événements de progression
  const handleImportProgress = useCallback((status) => {
    setProgressMessage(status.message);
    if (status.progress !== null) setCurrentProgress(status.progress);
    if (status.total !== null) setTotalProgress(status.total);

    // Si le message final est reçu
    if (status.message.includes('terminée') || status.message.includes('Erreur critique')) {
        setIsImporting(false);
        setImportStatus(status.message); // Met à jour le statut final
        // Appelle la fonction de rafraîchissement si elle existe
        if (onImportComplete) {
            onImportComplete();
        }
    }
  }, [onImportComplete]);

  // S'abonner et se désabonner au listener
  useEffect(() => {
    const removeListener = window.electronAPI.onSetImportProgress(handleImportProgress);
    return () => {
      if (removeListener && typeof removeListener === 'function') {
        removeListener();
      }
    };
  }, [handleImportProgress]);

  const handleImportData = async () => {
    setIsImporting(true);
    setProgressMessage('Initialisation...');
    setCurrentProgress(0);
    setTotalProgress(0);
    setImportStatus(''); // Réinitialiser le statut
    
    // Le résultat de la promesse est maintenant géré par le listener de progression
    window.electronAPI.importAllSetsAndPrintings();
  };

  return (
    <div style={{ border: '1px solid #3c3c3c', padding: '20px', margin: '20px', borderRadius: '8px', backgroundColor: '#2a2e37' }}>
      <h2><span role="img" aria-label="box icon">📦</span> Import Sets & Printings</h2>
      <button onClick={handleImportData} disabled={isImporting} style={{/* ...styles existants... */}}>
        {isImporting ? 'Importation en cours...' : 'Importer tous les Sets & Impressions'}
      </button>
      
      {/* NOUVEL AFFICHAGE DE LA PROGRESSION */}
      {isImporting && (
        <div style={{marginTop: '15px'}}>
          <p><em>{progressMessage}</em></p>
          {totalProgress > 0 && (
            <>
              <progress value={currentProgress} max={totalProgress} style={{ width: '100%', height: '20px' }}></progress>
              <p style={{textAlign: 'center'}}>{currentProgress} / {totalProgress}</p>
            </>
          )}
        </div>
      )}

      {!isImporting && importStatus && (
        <p style={{marginTop: '15px', fontWeight: 'bold', color: importStatus.includes('Erreur') ? '#ff8a80' : '#b9f6ca'}}>
          <strong>Statut:</strong> {importStatus}
        </p>
      )}
    </div>
  );
}

export default SetImporter;