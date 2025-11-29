import React, { useState, useEffect } from 'react';
import HomePage from './HomePage';
import SignLanguageMeet from './SignLanguageMeet';
import BenchmarkPage from './BenchmarkPage';
import PerformancePage from './PerformancePage';

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [isAppReady, setIsAppReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  useEffect(() => {
    // 1. Gestion de la navigation (URL)
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page');
    const room = params.get('room');

    if (page) setCurrentPage(page);
    else if (room) setCurrentPage('meet');
    else setCurrentPage('home');

    // 2. Chargement des Scripts IA (MediaPipe)
    const loadScripts = async () => {
      // Simulation de progression pour l'effet visuel (0 -> 80%)
      const progressInterval = setInterval(() => {
        setLoadProgress(prev => {
          if (prev >= 80) {
            clearInterval(progressInterval);
            return 80;
          }
          return prev + Math.random() * 5;
        });
      }, 100);

      // Fonction pour charger un script proprement
      const loadScript = (src) => {
        return new Promise((resolve, reject) => {
          if (document.querySelector(`script[src="${src}"]`)) {
            resolve(); // Déjà chargé
            return;
          }
          const script = document.createElement('script');
          script.src = src;
          script.async = true;
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      };

      try {
        // Chargement séquentiel
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
        // Petit délai pour assurer que window.Hands est défini
        await new Promise(r => setTimeout(r, 500));
        
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js');
        
        // Tout est chargé !
        clearInterval(progressInterval);
        setLoadProgress(100);
        
        // Petit délai pour voir la jauge pleine avant d'ouvrir
        setTimeout(() => setIsAppReady(true), 800);
        
      } catch (error) {
        console.error("Erreur de chargement des scripts", error);
        alert("Erreur de connexion : Impossible de charger l'IA.");
      }
    };

    loadScripts();
  }, []);

  // --- Écran de Chargement (Water Loader) ---
  if (!isAppReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans">
        {/* Cercle Conteneur */}
        <div className="relative w-48 h-48 rounded-full border-4 border-slate-700 bg-slate-900 water-loader shadow-2xl overflow-hidden mb-8">
          
          {/* L'eau qui monte (le top descend pour remplir) */}
          <div 
            className="water-wave" 
            style={{ top: `${100 - loadProgress}%` }}
          ></div>

          {/* Pourcentage au centre */}
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <span className="text-4xl font-bold text-white drop-shadow-md">
              {Math.round(loadProgress)}%
            </span>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2 animate-pulse">Chargement de l'IA</h2>
        <p className="text-slate-400">Initialisation des réseaux neuronaux...</p>
      </div>
    );
  }

  // --- Application Principale ---
  const renderPage = () => {
    switch (currentPage) {
      case 'meet': return <SignLanguageMeet />;
      case 'benchmark': return <BenchmarkPage />;
      case 'performance': return <PerformancePage />;
      default: return <HomePage />;
    }
  };

  return <>{renderPage()}</>;
}

export default App;