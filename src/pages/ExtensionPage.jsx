// src/pages/ExtensionPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import SetImporter from '../components/SetImporter.jsx';
import './ExtensionPage.css';

function ExtensionPage() {
    const [sets, setSets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalSets, setTotalSets] = useState(0);
    const limit = 100;

    const fetchSets = useCallback(async () => {
        setIsLoading(true);
        const result = await window.electronAPI.getAllSets({ page: currentPage, limit });
        if (result.success) {
            setSets(result.data.sets);
            setTotalSets(result.data.total);
        } else {
            console.error("Impossible de charger les sets:", result.message);
        }
        setIsLoading(false);
    }, [currentPage]);
    
    // La fonction de chargement est maintenant dépendante de la page actuelle
      useEffect(() => {
        fetchSets();
    }, [fetchSets]);

    // Calcul du nombre total de pages
    const totalPages = Math.ceil(totalSets / limit);

    return (
        <div className="extension-page">
            <header className="extension-header">
                <h1>Gestion des Extensions</h1>
                <p>Visualisez et mettez à jour la liste de toutes les extensions de cartes.</p>
            </header>

            <SetImporter onImportComplete={fetchSets} />

            <div className="set-list-container">
                <h2>Extensions dans la base de données ({totalSets})</h2>
                {isLoading ? (
                    <p>Chargement des extensions...</p>
                ) : (
                    <>
                        <table className="set-table">
                            <thead>
                                <tr>
                                    <th>N°</th>
                                    <th>Nom du Set</th>
                                    <th>Code</th>
                                    <th>Date de Sortie (TCG)</th>
                                    <th>Nombre de cartes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sets.map((set, index) => (
                                    <tr key={set.id}>
                                        <td>{((currentPage - 1) * limit) + (index + 1)}</td>
                                        <td>{set.set_name}</td>
                                        <td>{set.set_code}</td>
                                        <td>{set.release_date_tcg_na || 'N/A'}</td>
                                        <td>{set.card_count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="pagination-controls">
                            <button 
                                onClick={() => setCurrentPage(p => p - 1)} 
                                disabled={currentPage === 1}
                            >
                                Précédent
                            </button>
                            <span>
                                Page {currentPage} sur {totalPages}
                            </span>
                            <button 
                                onClick={() => setCurrentPage(p => p + 1)} 
                                disabled={currentPage === totalPages}
                            >
                                Suivant
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default ExtensionPage;