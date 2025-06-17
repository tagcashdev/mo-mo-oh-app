// src/pages/ExtensionPage.jsx

import React, { useState, useEffect } from 'react';
import SetImporter from '../components/SetImporter.jsx';
import './ExtensionPage.css'; // Nous créerons ce fichier CSS

function ExtensionPage() {
    const [sets, setSets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSets = async () => {
            setIsLoading(true);
            const result = await window.electronAPI.getAllSets();
            if (result.success) {
                setSets(result.data);
            } else {
                console.error("Impossible de charger les sets:", result.message);
            }
            setIsLoading(false);
        };
        fetchSets();
    }, []);

    return (
        <div className="extension-page">
            <header className="extension-header">
                <h1>Gestion des Extensions</h1>
                <p>Visualisez et mettez à jour la liste de toutes les extensions de cartes.</p>
            </header>

            <SetImporter />

            <div className="set-list-container">
                <h2>Extensions dans la base de données ({sets.length})</h2>
                {isLoading ? (
                    <p>Chargement des extensions...</p>
                ) : (
                    <table className="set-table">
                        <thead>
                            <tr>
                                <th>Nom du Set</th>
                                <th>Code</th>
                                <th>Date de Sortie (TCG)</th>
                                <th>Nombre de cartes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sets.map(set => (
                                <tr key={set.id}>
                                    <td>{set.set_name}</td>
                                    <td>{set.set_code}</td>
                                    <td>{set.release_date_tcg_na || 'N/A'}</td>
                                    <td>{set.card_count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default ExtensionPage;