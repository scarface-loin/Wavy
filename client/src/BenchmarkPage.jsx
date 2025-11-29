import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart, Play, CheckCircle, AlertTriangle, 
  Settings, ArrowRight, RotateCcw, Cpu 
} from 'lucide-react';

const SCENARIOS = [
  { id: 'lite_1', name: 'Mode Rapide (1 Main)', complexity: 0, maxHands: 1, desc: "Modèle Lite. Idéal pour vieux mobiles." },
  { id: 'full_1', name: 'Mode Précis (1 Main)', complexity: 1, maxHands: 1, desc: "Modèle Standard. Recommandé pour la LSF." },
  { id: 'lite_2', name: 'Mode Duo Rapide', complexity: 0, maxHands: 2, desc: "2 mains, précision réduite." },
  { id: 'full_2', name: 'Mode Duo Précis', complexity: 1, maxHands: 2, desc: "Charge lourde. Teste la limite du GPU." },
];

const FRAMES_TO_TEST = 60; // Nombre d'images à analyser par test

const BenchmarkPage = () => {
  const [currentStep, setCurrentStep] = useState(-1); // -1: Idle, 0-3: Test index
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({});
  const [isFinished, setIsFinished] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const videoRef = useRef(null);
  const handsRef = useRef(null);
  const frameIdRef = useRef(null);
  const streamRef = useRef(null);
  
  // Stats temporaires pour le test en cours
  const perfData = useRef({
    startTime: 0,
    framesProcessed: 0,
    totalInferenceTime: 0
  });

  useEffect(() => {
    initCamera();
    return () => stopEverything();
  }, []);

  const initCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 },
        audio: false 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setVideoReady(true);
          initMediaPipe();
        };
      }
    } catch (err) {
      console.error("Erreur caméra", err);
    }
  };

  const initMediaPipe = () => {
    const hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    // Options par défaut pour initialiser
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    hands.onResults(onResults);
    handsRef.current = hands;
  };

  const stopEverything = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
    if (handsRef.current) handsRef.current.close();
  };

  const startBenchmark = () => {
    setResults({});
    setIsFinished(false);
    setCurrentStep(0);
    runScenario(0);
  };

  const runScenario = async (index) => {
    if (index >= SCENARIOS.length) {
      finishBenchmark();
      return;
    }

    const scenario = SCENARIOS[index];
    console.log(`Lancement: ${scenario.name}`);

    // 1. Configurer MediaPipe
    if (handsRef.current) {
      await handsRef.current.setOptions({
        maxNumHands: scenario.maxHands,
        modelComplexity: scenario.complexity
      });
    }

    // 2. Reset des compteurs
    perfData.current = {
      startTime: performance.now(),
      framesProcessed: 0,
      totalInferenceTime: 0
    };
    setProgress(0);

    // 3. Lancer la boucle de détection
    detectLoop(index);
  };

  const detectLoop = async (scenarioIndex) => {
    if (!videoRef.current || !handsRef.current) return;

    const tStart = performance.now();
    await handsRef.current.send({ image: videoRef.current });
    const tEnd = performance.now();

    perfData.current.totalInferenceTime += (tEnd - tStart);
    perfData.current.framesProcessed += 1;

    // Mise à jour barre de progression
    const currentProgress = (perfData.current.framesProcessed / FRAMES_TO_TEST) * 100;
    setProgress(currentProgress);

    if (perfData.current.framesProcessed < FRAMES_TO_TEST) {
      frameIdRef.current = requestAnimationFrame(() => detectLoop(scenarioIndex));
    } else {
      // Fin du scénario
      saveResult(scenarioIndex);
      // Attendre un peu avant le suivant (refroidissement JS)
      setTimeout(() => {
        const next = scenarioIndex + 1;
        setCurrentStep(next);
        runScenario(next);
      }, 500);
    }
  };

  const onResults = () => {
    // Callback vide nécessaire pour que send() fonctionne
  };

  const saveResult = (index) => {
    const totalTime = performance.now() - perfData.current.startTime;
    const avgInference = perfData.current.totalInferenceTime / FRAMES_TO_TEST;
    // FPS réel (incluant le rendu et la boucle)
    const fps = Math.round((FRAMES_TO_TEST / totalTime) * 1000); 

    setResults(prev => ({
      ...prev,
      [SCENARIOS[index].id]: {
        fps,
        latency: Math.round(avgInference),
        score: calculateScore(fps, avgInference)
      }
    }));
  };

  const finishBenchmark = () => {
    setCurrentStep(-1);
    setIsFinished(true);
  };

  const calculateScore = (fps, latency) => {
    // Score arbitraire sur 100
    // Idéal: 60 FPS et < 10ms latence
    let score = 0;
    score += Math.min(fps, 60) * 1; // Max 60 pts pour FPS
    score += Math.max(0, 40 - (latency / 2)); // Max 40 pts pour latence
    return Math.round(Math.max(0, Math.min(100, score)));
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-400";
    if (score >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="text-blue-500 animate-spin-slow" />
            Benchmark IA MediaPipe
          </h1>
          <p className="text-slate-400 mt-2">
            Testez les capacités de votre appareil pour trouver la configuration optimale.
            Gardez cette page au premier plan.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Panneau de Contrôle */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl relative overflow-hidden">
              {!videoReady && (
                <div className="absolute inset-0 bg-slate-900 z-10 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-slate-400">Initialisation Caméra...</p>
                  </div>
                </div>
              )}
              
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">État du test</h2>
                  <p className="text-sm text-slate-500">
                    {currentStep >= 0 
                      ? `Test en cours : ${SCENARIOS[currentStep].name}` 
                      : isFinished ? "Benchmark terminé" : "Prêt à démarrer"}
                  </p>
                </div>
                {currentStep === -1 && (
                  <button 
                    onClick={startBenchmark}
                    disabled={!videoReady}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl font-bold transition shadow-lg shadow-blue-900/20"
                  >
                    {isFinished ? <RotateCcw size={20}/> : <Play size={20}/>}
                    {isFinished ? "Relancer" : "Lancer le Benchmark"}
                  </button>
                )}
              </div>

              {/* Barre de progression */}
              {currentStep >= 0 && (
                <div className="mb-6">
                  <div className="flex justify-between text-xs text-slate-400 mb-2">
                    <span>Progression ({SCENARIOS[currentStep].name})</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  {/* Prévisualisation technique */}
                  <div className="mt-4 p-4 bg-black/40 rounded-xl border border-white/5 flex gap-4 text-xs font-mono text-slate-300">
                     <span className="flex items-center gap-2"><Cpu size={14}/> {perfData.current.framesProcessed} frames</span>
                     <span>Complexity: {SCENARIOS[currentStep].complexity}</span>
                  </div>
                </div>
              )}

              {/* Résultats en direct */}
              <div className="space-y-3">
                {SCENARIOS.map((scenario) => {
                  const res = results[scenario.id];
                  const isActive = currentStep !== -1 && SCENARIOS[currentStep].id === scenario.id;
                  
                  return (
                    <div 
                      key={scenario.id}
                      className={`
                        p-4 rounded-xl border transition-all duration-300 flex items-center justify-between
                        ${isActive ? 'bg-blue-900/20 border-blue-500/50 scale-[1.02]' : 'bg-slate-800/50 border-slate-700/50'}
                      `}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`
                          w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                          ${res ? (res.score > 70 ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400') : 'bg-slate-700 text-slate-500'}
                        `}>
                          {res ? res.score : '?'}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm">{scenario.name}</h3>
                          <p className="text-xs text-slate-500 hidden sm:block">{scenario.desc}</p>
                        </div>
                      </div>

                      {res ? (
                        <div className="text-right">
                          <div className="text-lg font-bold text-white">{res.fps} <span className="text-xs text-slate-500">FPS</span></div>
                          <div className="text-xs text-slate-400">{res.latency}ms latence</div>
                        </div>
                      ) : (
                        isActive && <span className="text-xs text-blue-400 animate-pulse">Test en cours...</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recommandations */}
          <div className="md:col-span-1">
             <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 h-full">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <BarChart size={20} className="text-purple-500"/>
                  Analyse
                </h3>

                {!isFinished ? (
                  <div className="text-center py-10 text-slate-500">
                    <p>Lancez le benchmark pour obtenir des recommandations personnalisées.</p>
                  </div>
                ) : (
                  <div className="space-y-6 animate-fade-in">
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                      <h4 className="font-bold text-green-400 text-sm mb-2 flex items-center gap-2">
                        <CheckCircle size={16}/> Configuration Recommandée
                      </h4>
                      <p className="text-white font-medium">
                        {results['full_1']?.fps > 25 
                          ? "✅ Mode Précis (Full)" 
                          : "⚡ Mode Rapide (Lite)"}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {results['full_1']?.fps > 25 
                          ? "Votre appareil gère bien le modèle complexe."
                          : "Votre appareil préfère le modèle léger pour rester fluide."}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-500 uppercase">Détails techniques</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Perte FPS (Full vs Lite)</span>
                        <span className="text-white">
                           {results['lite_1'] && results['full_1'] 
                             ? `${Math.round(((results['lite_1'].fps - results['full_1'].fps) / results['lite_1'].fps) * 100)}%` 
                             : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Coût Latence 2 Mains</span>
                        <span className="text-white">
                           {results['lite_1'] && results['lite_2'] 
                             ? `+${results['lite_2'].latency - results['lite_1'].latency}ms` 
                             : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <a href="/" className="block w-full py-3 bg-slate-800 hover:bg-slate-700 text-center rounded-xl transition text-sm font-medium">
                      Retour à l'application
                    </a>
                  </div>
                )}
             </div>
          </div>
        </div>
        
        {/* Vidéo cachée */}
        <video ref={videoRef} className="hidden" playsInline muted autoPlay />
      </div>
    </div>
  );
};

export default BenchmarkPage;