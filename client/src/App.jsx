import React, { useState, useEffect } from 'react';
import HomePage from './HomePage';
import SignLanguageMeet from './SignLanguageMeet';
import BenchmarkPage from './BenchmarkPage';
import PerformancePage from './PerformancePage';

function App() {
  const [currentPage, setCurrentPage] = useState('home');

  useEffect(() => {
    // Analyse l'URL au chargement : monsite.com/?page=meet
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page');
    const room = params.get('room'); // Si on a un lien de partage direct

    if (page) {
      setCurrentPage(page);
    } else if (room) {
      // Si quelqu'un arrive avec un lien d'invitation direct (?room=XYZ), on l'envoie direct au meet
      setCurrentPage('meet');
    } else {
      setCurrentPage('home');
    }
  }, []);

  // Fonction de rendu conditionnel
  const renderPage = () => {
    switch (currentPage) {
      case 'meet':
        return <SignLanguageMeet />;
      case 'benchmark':
        return <BenchmarkPage />;
      case 'performance':
        return <PerformancePage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <>
      {renderPage()}
    </>
  );
}

export default App;