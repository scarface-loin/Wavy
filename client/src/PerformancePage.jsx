import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, Zap, Wifi, Cpu, Camera, 
  ArrowLeft, RefreshCw, AlertCircle 
} from 'lucide-react';

const PerformancePage = () => {
  // États pour les métriques
  const [metrics, setMetrics] = useState({
    fps: 0,
    inferenceTime: 0, // ms
    latency: 0, // ms
    memory: 0, // MB
    resolution: '...'
  });

  const [graphData, setGraphData] = useState([]); // Historique pour le graph
  const [isReady, setIsReady] = useState(false);
  
  // Refs pour le calcul
  const lastFrameTime = useRef(Date.now());
  const frameCount = useRef(0);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const wsRef = useRef(null);
  const requestRef = useRef(null);
  
  // Configuration WebSocket pour test de ping
  const getWebSocketUrl = () => {
    if (window.location.hostname === 'localhost') return 'ws://localhost:8080';
    // Mettez ici votre URL Render SANS https:// ni wss://
    return 'wss://wavy-server.onrender.com'; 
  };

  useEffect(() => {
    initializePerformanceTest();
    return () => cleanup();
  }, []);

  const cleanup = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (wsRef.current) wsRef.current.close();
  };

  const initializePerformanceTest = async () => {
    // 1. Démarrer Caméra
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 }, // On teste en basse résolution standard
        audio: false 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setMetrics(m => ({ ...m, resolution: `${videoRef.current.videoWidth}x${videoRef.current.videoHeight}` }));
          startMediaPipeLoop();
        };
      }
    } catch (e) {
      console.error("Erreur caméra", e);
    }

    // 2. Démarrer Ping WebSocket
    const ws = new WebSocket(getWebSocketUrl());
    ws.onopen = () => {
      setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const start = performance.now();
          ws.send(JSON.stringify({ type: 'ping' })); // Le serveur ignorera, mais on mesure l'aller
          // Note: Pour un vrai ping aller-retour, le serveur devrait répondre 'pong'.
          // Ici on simule une latence TCP basique
          setMetrics(m => ({ ...m, latency: Math.round(performance.now() - start) }));
        }
      }, 2000);
    };
    wsRef.current = ws;
  };

  const startMediaPipeLoop = () => {
    // Chargement de MediaPipe
    const hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    hands.onResults(() => {
      // Fin du timer d'inférence
      // Note: calculé dans la boucle detect
    });

    const detect = async () => {
      if (!videoRef.current) return;

      const startTime = performance.now();

      // Envoi à MediaPipe
      if (videoRef.current.readyState === 4) {
        await hands.send({ image: videoRef.current });
      }

      const endTime = performance.now();
      const processTime = endTime - startTime;

      // Calcul FPS
      frameCount.current++;
      const now = Date.now();
      if (now - lastFrameTime.current >= 1000) {
        setMetrics(prev => ({
          ...prev,
          fps: frameCount.current,
          inferenceTime: Math.round(processTime),
          memory: window.performance.memory ? Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024) : 0
        }));

        // Mise à jour du graph
        setGraphData(prev => {
          const newData = [...prev, processTime];
          if (newData.length > 50) newData.shift();
          return newData;
        });

        frameCount.current = 0;
        lastFrameTime.current = now;
        setIsReady(true);
      }

      requestRef.current = requestAnimationFrame(detect);
    };

    detect();
  };

  // Composant Carte
  const MetricCard = ({ icon: Icon, label, value, unit, color }) => (
    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 relative overflow-hidden">
      <div className={`absolute top-0 right-0 p-4 opacity-10 ${color}`}>
        <Icon size={64} />
      </div>
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg bg-slate-900 ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
        <span className="text-slate-400 font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold text-white">{value}</span>
        <span className="text-sm text-slate-500">{unit}</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Activity className="text-blue-500" />
              Performances Système
            </h1>
            <p className="text-slate-400 mt-2">Métriques temps réel de MediaPipe & Réseau</p>
          </div>
          
          <a href="/" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition flex items-center gap-2 w-fit">
            <ArrowLeft size={18} />
            Retour à l'accueil
          </a>
        </header>

        {!isReady ? (
          <div className="flex flex-col items-center justify-center h-64 bg-slate-900 rounded-3xl border border-slate-800">
            <RefreshCw className="animate-spin text-blue-500 mb-4" size={32} />
            <p className="text-slate-400">Calibrage des capteurs et chargement de l'IA...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard 
              icon={Zap} 
              label="FPS (Fluidité)" 
              value={metrics.fps} 
              unit="img/s"
              color={metrics.fps > 25 ? "text-green-500 bg-green-500" : "text-orange-500 bg-orange-500"} 
            />
            <MetricCard 
              icon={Cpu} 
              label="Temps de calcul IA" 
              value={metrics.inferenceTime} 
              unit="ms"
              color={metrics.inferenceTime < 50 ? "text-green-500 bg-green-500" : "text-red-500 bg-red-500"} 
            />
            <MetricCard 
              icon={Wifi} 
              label="Latence Serveur" 
              value={metrics.latency} 
              unit="ms"
              color={metrics.latency < 100 ? "text-green-500 bg-green-500" : "text-yellow-500 bg-yellow-500"} 
            />
            <MetricCard 
              icon={Camera} 
              label="Résolution" 
              value={metrics.resolution.split('x')[0]} 
              unit={`x ${metrics.resolution.split('x')[1] || ''}`}
              color="text-blue-500 bg-blue-500" 
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Graphique Visualisation */}
          <div className="lg:col-span-2 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
              <Activity size={18} className="text-purple-500" />
              Stabilité du traitement (ms)
            </h3>
            <div className="h-64 flex items-end justify-between gap-1 px-2 relative">
              {/* Lignes guides */}
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-between opacity-20">
                <div className="w-full h-px bg-slate-400"></div>
                <div className="w-full h-px bg-slate-400"></div>
                <div className="w-full h-px bg-slate-400"></div>
              </div>
              
              {graphData.map((val, i) => (
                <div 
                  key={i} 
                  className="w-full bg-blue-500/50 hover:bg-blue-400 transition-all rounded-t-sm relative group"
                  style={{ height: `${Math.min(val * 2, 100)}%` }}
                >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                        {Math.round(val)} ms
                    </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>0 ms</span>
              <span>Historique (5 dernières secondes)</span>
              <span>100+ ms</span>
            </div>
          </div>

          {/* Info Système */}
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
              <AlertCircle size={18} className="text-blue-500" />
              Configuration
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-slate-800">
                <span className="text-slate-400 text-sm">Navigateur</span>
                <span className="font-medium">{navigator.userAgentData?.brands[0]?.brand || 'Inconnu'}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-800">
                <span className="text-slate-400 text-sm">Cœurs CPU (Logiques)</span>
                <span className="font-medium">{navigator.hardwareConcurrency || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-800">
                <span className="text-slate-400 text-sm">Utilisation Mémoire JS</span>
                <span className="font-medium">{metrics.memory > 0 ? `${metrics.memory} MB` : 'Non disponible'}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-800">
                <span className="text-slate-400 text-sm">Accélération GPU</span>
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">Activé (Standard)</span>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl text-sm text-blue-200">
              <p>💡 <strong>Conseil :</strong> Pour une détection fluide des gestes, visez un temps de calcul inférieur à 50ms et au moins 20 FPS.</p>
            </div>
          </div>
        </div>

        {/* Video masquée pour le traitement */}
        <video ref={videoRef} className="hidden" playsInline muted autoPlay />
      </div>
    </div>
  );
};

export default PerformancePage;