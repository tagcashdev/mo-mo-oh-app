// src/components/DataImporter.jsx
import React, { useState, useEffect, useCallback } from 'react';

function ButtonImporter() {
  const [importStatus, setImportStatus] = useState('');
  const [progressMessage, setProgressMessage] = useState('');
  const [currentProgress, setCurrentProgress] = useState(0);
  const [totalProgress, setTotalProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);

  // Utilisation de useCallback pour mémoriser la fonction de callback
  const handleImportProgress = useCallback((status) => {
    setProgressMessage(status.message);
    if (status.progress !== null) setCurrentProgress(status.progress);
    if (status.total !== null) setTotalProgress(status.total);
    if (status.message.includes('Importation terminée') || status.message.includes('Erreur critique')) {
        // Optionnel: réinitialiser la barre de progression un peu après la fin ou l'erreur
        setTimeout(() => {
            // setCurrentProgress(0);
            // setTotalProgress(0);
        }, 5000);
    }
  }, []); // Pas de dépendances, donc la fonction n'est créée qu'une fois

  useEffect(() => {
    // S'abonner aux messages de progression
    const removeListener = window.electronAPI.onImportProgress(handleImportProgress);

    // Nettoyage du listener lors du démontage du composant
    return () => {
      // Pour retirer le listener spécifique, il faudrait que preload.js retourne une fonction de désinscription
      // ou que ipcRenderer.removeListener soit exposé de manière sécurisée.
      // Exemple de ce que pourrait faire preload.js pour retourner une fonction de désinscription :
      // onImportProgress: (callback) => {
      //   const handler = (_event, value) => callback(value);
      //   ipcRenderer.on('import-progress', handler);
      //   return () => ipcRenderer.removeListener('import-progress', handler);
      // }
      // Si votre preload.js ne retourne pas de fonction de désinscription, le listener restera actif
      // mais Electron est généralement assez robuste pour gérer cela.
      // Pour l'instant, on suppose que le listener est soit global, soit qu'il n'y a pas de fuite mémoire critique.
      // Si vous avez une fonction pour retirer le listener exposée via preload, appelez-la ici.
      // Exemple : if (removeListener && typeof removeListener === 'function') removeListener();
    };
  }, [handleImportProgress]); // Ajouter handleImportProgress aux dépendances de useEffect

  const handleImportData = async () => {
    setIsImporting(true);
    setImportStatus('Demande d\'importation envoyée...');
    setProgressMessage('Initialisation de l\'importation...');
    setCurrentProgress(0);
    setTotalProgress(0);
    try {
      // L'API exposée via preload.js
      const result = await window.electronAPI.importAllCards();
      setImportStatus(result.message); // Message final de succès ou d'échec global
    } catch (error) {
      setImportStatus(`Erreur lors du lancement de l'importation: ${error.message}`);
      console.error("Erreur d'importation (côté renderer):", error);
    }
    // Ne pas mettre setIsImporting(false) ici si on veut que le message final reste
    // Le message de progression 'Importation terminée' devrait le signaler.
    // Ou alors, le faire après un délai si 'Importation terminée' n'arrête pas l'état "isImporting"
    // setIsImporting(false);
  };

  useEffect(() => {
    if (progressMessage.includes('Importation terminée') || progressMessage.includes('Erreur critique d\'importation')) {
        setIsImporting(false);
    }
  }, [progressMessage]);


  return (
    <div style={{ border: '1px solid #3c3c3c', padding: '20px', margin: '20px', borderRadius: '8px' }}>
      <h2><span role="img" aria-label="download icon">📥</span> Import Cards</h2>
      <button onClick={handleImportData} disabled={isImporting} style={{padding: '10px 15px', background: 'rgba(255, 255, 255, 0.4)', fontSize: '16px', cursor: isImporting ? 'not-allowed' : 'pointer'}}>
        {isImporting ? 'Import in progress...' : 'Start Importing Data'}
      </button>
      {importStatus && <p style={{marginTop: '15px'}}><strong>Statut Global:</strong> {importStatus}</p>}
      {progressMessage && <p><em>{progressMessage}</em></p>}
      {isImporting && totalProgress > 0 && (
        <div style={{marginTop: '10px'}}>
          <progress value={currentProgress} max={totalProgress} style={{ width: '100%', height: '20px' }}></progress>
          <p style={{textAlign: 'center'}}>{currentProgress} / {totalProgress} cartes traitées</p>
        </div>
      )}
       {!isImporting && progressMessage.includes('Importation terminée') && (
        <p style={{color: 'green', fontWeight: 'bold'}}>✅ Importation complétée avec succès !</p>
      )}
      {!isImporting && progressMessage.includes('Erreur critique') && (
        <p style={{color: 'red', fontWeight: 'bold'}}>❌ Une erreur critique est survenue lors de l'importation.</p>
      )}
    </div>
  );
}

export default ButtonImporter;