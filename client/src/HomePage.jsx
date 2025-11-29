import React from 'react';
import { Video, Activity, Settings, ArrowRight, Hand, Sparkles } from 'lucide-react';

const HomePage = () => {
  const cards = [
    {
      id: 'meet',
      title: "Rejoindre une Salle",
      description: "Discutez en temps réel avec la traduction automatique de la langue des signes.",
      icon: Video,
      color: "from-blue-500 to-indigo-600",
      btnText: "Démarrer",
      link: "?page=meet"
    },
    {
      id: 'benchmark',
      title: "Benchmark IA",
      description: "Testez la puissance de votre appareil pour trouver les réglages optimaux.",
      icon: Settings,
      color: "from-purple-500 to-pink-600",
      btnText: "Lancer le test",
      link: "?page=benchmark"
    },
    {
      id: 'performance',
      title: "Moniteur Système",
      description: "Analysez les FPS, la latence réseau et la consommation mémoire en direct.",
      icon: Activity,
      color: "from-emerald-500 to-teal-600",
      btnText: "Analyser",
      link: "?page=performance"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col relative overflow-hidden font-sans">
      {/* Fond décoratif */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="container mx-auto px-6 py-12 relative z-10 flex-1 flex flex-col justify-center">
        
        {/* En-tête */}
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl mb-4 shadow-xl">
            <Hand className="w-8 h-8 text-blue-400 mr-2" />
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">Wavy</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6">
            L'accessibilité <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">au bout des doigts</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Une suite d'outils performants pour la communication en Langue des Signes assistée par Intelligence Artificielle.
          </p>
        </div>

        {/* Grille de sélection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto w-full">
          {cards.map((card) => (
            <a 
              key={card.id} 
              href={card.link}
              className="group relative bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-3xl p-8 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 flex flex-col"
            >
              <div className={`
                w-14 h-14 rounded-2xl bg-gradient-to-br ${card.color} 
                flex items-center justify-center mb-6 shadow-lg transform group-hover:scale-110 transition-transform duration-300
              `}>
                <card.icon className="w-7 h-7 text-white" />
              </div>
              
              <h3 className="text-2xl font-bold mb-3 text-white group-hover:text-blue-400 transition-colors">
                {card.title}
              </h3>
              
              <p className="text-slate-400 mb-8 flex-1 leading-relaxed">
                {card.description}
              </p>
              
              <div className="flex items-center text-sm font-bold text-slate-300 group-hover:text-white transition-colors">
                {card.btnText}
                <ArrowRight className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" />
              </div>

              {/* Effet de lueur au survol */}
              <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}></div>
            </a>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-8 text-slate-600 text-sm relative z-10">
        <p>© 2025 Soureya YAYA & Ndjeumou kambea steve</p>
      </footer>
    </div>
  );
};

export default HomePage;