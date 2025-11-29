import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Users, Copy, Check, LogOut, Send, 
  Mic, MicOff, Video, VideoOff, Hand, Loader2, 
  Sparkles, MessageSquare, Link2
} from 'lucide-react';

const SignLanguageMeet = () => {
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [isInRoom, setIsInRoom] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [currentGesture, setCurrentGesture] = useState('...');
  const [confidence, setConfidence] = useState(0);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [copied, setCopied] = useState(false);
  const [ws, setWs] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handsRef = useRef(null);
  const streamRef = useRef(null);
  const requestRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRoomId = params.get('room');
    if (urlRoomId) {
      setRoomId(urlRoomId.toUpperCase());
    }
  }, []);

  useEffect(() => {
    const loadScripts = async () => {
      const script1 = document.createElement('script');
      script1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
      script1.async = true;
      document.body.appendChild(script1);

      script1.onload = () => {
        const script2 = document.createElement('script');
        script2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js';
        script2.async = true;
        document.body.appendChild(script2);
      };
    };
    loadScripts();

    return () => {
      stopCamera();
      if (ws) ws.close();
    };
  }, []);

  const recognizeGesture = (landmarks) => {
    if (!landmarks || landmarks.length === 0) return { word: '...', conf: 0 };

    const fingers = [];
    fingers.push(Math.abs(landmarks[4].x - landmarks[17].x) > Math.abs(landmarks[3].x - landmarks[17].x) ? 1 : 0);

    const tips = [8, 12, 16, 20];
    const pips = [6, 10, 14, 18];
    tips.forEach((tip, i) => {
      fingers.push(landmarks[tip].y < landmarks[pips[i]].y ? 1 : 0);
    });

    const dist = (p1, p2) => Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const thumbIndex = dist(landmarks[4], landmarks[8]);
    const indexMiddle = dist(landmarks[8], landmarks[12]);

    if (thumbIndex < 0.05 && fingers[2] && fingers[3] && fingers[4]) return { word: 'Parfait / OK', conf: 95 };
    if (fingers.every(f => f === 1)) return indexMiddle > 0.08 ? { word: 'Cinq / Stop', conf: 92 } : { word: 'Bonjour', conf: 90 };
    if (!fingers[0] && fingers[1] && fingers[2] && fingers[3] && fingers[4]) return { word: 'Merci', conf: 88 };
    if (fingers[1] && fingers[2] && !fingers[3] && !fingers[4]) return indexMiddle > 0.06 ? { word: 'Victoire', conf: 92 } : { word: 'Lettre U', conf: 85 };
    if (fingers[0] && !fingers[1] && !fingers[2] && !fingers[3] && fingers[4]) return { word: 'Appelle-moi', conf: 96 };
    if (fingers[0] && fingers[1] && !fingers[2] && !fingers[3] && fingers[4]) return { word: 'Je t\'aime', conf: 94 };
    if (!fingers[0] && fingers[1] && !fingers[2] && !fingers[3] && fingers[4]) return { word: 'Rock & Roll', conf: 91 };
    if (fingers[1] && !fingers[2] && !fingers[3] && !fingers[4]) return { word: 'Non / Un', conf: 89 };
    if (fingers[0] && !fingers[1] && !fingers[2] && !fingers[3] && !fingers[4]) return { word: 'Super / Oui', conf: 93 };
    if (fingers.every(f => f === 0)) return { word: 'Poing', conf: 90 };

    return { word: '...', conf: 0 };
  };

  const startCamera = async () => {
    setIsLoading(true);
    setCameraError(null);

    if (!window.Hands) {
      setTimeout(startCamera, 1000);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: true
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          startDetection();
        };
      }
    } catch (err) {
      console.error('Erreur caméra:', err);
      setCameraError("Impossible d'accéder à la caméra. Vérifiez vos permissions.");
      setIsLoading(false);
    }
  };

  const startDetection = () => {
    const video = videoRef.current;

    const hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5
    });

    hands.onResults(onResults);
    handsRef.current = hands;

    const detect = async () => {
      if (video && video.readyState === 4 && !video.paused && !video.ended) {
        await hands.send({ image: video });
      }
      requestRef.current = requestAnimationFrame(detect);
    };
    detect();
  };

  const onResults = (results) => {
    setIsLoading(false);

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (const landmarks of results.multiHandLandmarks) {
        if (window.drawConnectors && window.drawLandmarks) {
          window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {color: '#60A5FA', lineWidth: 3});
          window.drawLandmarks(ctx, landmarks, {color: '#F472B6', lineWidth: 1, radius: 4});
        }
        
        const gesture = recognizeGesture(landmarks);
        
        if (gesture.conf > 70) {
            setCurrentGesture(gesture.word);
            setConfidence(gesture.conf);
            
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                type: 'gesture',
                gesture: gesture.word,
                confidence: gesture.conf,
                username
                }));
            }
        }
      }
    }
    ctx.restore();
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
  };


  const getWebSocketUrl = () => {
    const backendUrl = 'wavy-server.onrender.com'; 
    return `wss://${backendUrl}`;
  };

  const joinRoom = () => {
    if (!roomId || !username) return;

    const wsUrl = getWebSocketUrl();
    const socket = new WebSocket(`${wsUrl}/room/${roomId}`);
    
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'join', username, roomId }));
      setIsInRoom(true);
      startCamera();
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'participants') setParticipants(data.participants);
      else if (data.type === 'participant_joined') setParticipants(data.participants);
      else if (data.type === 'participant_left') setParticipants(data.participants);
      else if (data.type === 'gesture' || data.type === 'message') {
        setMessages(prev => [...prev, {
            user: data.username,
            text: data.type === 'gesture' ? data.gesture : data.message,
            isGesture: data.type === 'gesture',
            confidence: data.confidence,
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        }]);
      }
    };

    socket.onclose = () => {
      setIsInRoom(false);
      stopCamera();
    };

    setWs(socket);
  };

  const sendMessage = (text) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'message', message: text, username }));
    }
  };

  const generateShareLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}?room=${roomId}`;
  };

  const copyShareLink = () => {
    const link = generateShareLink();
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const createNewRoom = () => {
    const newRoomId = Math.random().toString(36).substr(2, 6).toUpperCase();
    setRoomId(newRoomId);
    window.history.pushState({}, '', `?room=${newRoomId}`);
  };

  const leaveRoom = () => {
    if (ws) ws.close();
    stopCamera();
    setIsInRoom(false);
  };

  if (!isInRoom) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[100px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[100px] animate-pulse"></div>
        </div>

        <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 max-w-md w-full shadow-2xl relative z-10">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4 shadow-lg shadow-blue-500/20 rotate-3 hover:rotate-6 transition-transform">
              <Hand className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Wavy</h1>
            <p className="text-slate-400">Visioconférence & Langue des Signes</p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2 ml-1">Comment vous appelez-vous ?</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Votre prénom"
                className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2 ml-1">Code de la réunion</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="EX: ROOM1"
                  className="flex-1 px-5 py-4 bg-slate-900/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition font-mono uppercase"
                />
                <button
                  onClick={createNewRoom}
                  className="px-5 py-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-2xl transition font-medium"
                  title="Générer un code aléatoire"
                >
                  <Sparkles className="w-5 h-5" />
                </button>
              </div>
            </div>

            {roomId && (
              <div className="bg-slate-900/30 border border-slate-700/50 rounded-2xl p-4">
                <p className="text-xs text-slate-400 mb-2 flex items-center gap-2">
                  <Link2 className="w-3.5 h-3.5" />
                  Lien de partage
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={generateShareLink()}
                    readOnly
                    className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300 text-xs font-mono truncate"
                  />
                  <button
                    onClick={copyShareLink}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition flex items-center gap-2 text-sm font-medium"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span className="hidden sm:inline">Copié!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span className="hidden sm:inline">Copier</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  Partagez ce lien avec les participants
                </p>
              </div>
            )}

            <button
              onClick={joinRoom}
              disabled={!roomId || !username}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-900/20 transition-all transform active:scale-[0.98] mt-4"
            >
              Rejoindre maintenant
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col overflow-hidden text-slate-100">
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 z-50">
        <div className="max-w-[1920px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-lg">
                <Hand className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight hidden sm:block">Wavy</span>
            </div>
            <div className="hidden md:flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700">
              <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Code:</span>
              <span className="text-white font-mono font-bold select-all">{roomId}</span>
              <button 
                onClick={() => {navigator.clipboard.writeText(roomId); setCopied(true); setTimeout(() => setCopied(false), 2000)}} 
                className="text-slate-400 hover:text-white transition ml-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex -space-x-2">
                {participants.slice(0, 3).map((p, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-xs font-bold">
                        {p.username.charAt(0)}
                    </div>
                ))}
                {participants.length > 3 && (
                    <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-xs font-bold text-slate-400">
                        +{participants.length - 3}
                    </div>
                )}
             </div>
            <button
              onClick={() => { leaveRoom(); window.location.reload(); }}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl transition font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Quitter</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-4 md:p-6 flex flex-col relative">
          <div className={`flex-1 relative bg-slate-900 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 ${confidence > 80 ? 'ring-2 ring-blue-500 shadow-blue-500/20' : 'border border-slate-800'}`}>
            {cameraError && (
               <div className="absolute inset-0 flex items-center justify-center z-50 bg-slate-900">
                  <div className="text-center p-6 max-w-md">
                     <VideoOff className="w-16 h-16 text-red-500 mx-auto mb-4" />
                     <h3 className="text-xl font-bold text-white mb-2">Erreur Caméra</h3>
                     <p className="text-slate-400">{cameraError}</p>
                  </div>
               </div>
            )}

            {isLoading && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-40 bg-slate-900/90 backdrop-blur-sm">
                <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-4" />
                <h3 className="text-xl font-medium text-white animate-pulse">Initialisation de l'IA...</h3>
                <p className="text-slate-400 text-sm mt-2">Veuillez patienter quelques secondes</p>
              </div>
            )}

            <video ref={videoRef} className="hidden" playsInline muted autoPlay />
            <canvas ref={canvasRef} className="w-full h-full object-cover" />

            <div className="absolute top-6 left-6 flex items-center gap-3">
              <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                 <span className="font-semibold text-sm">{username} (Vous)</span>
              </div>
            </div>

            <div className="absolute bottom-8 left-0 right-0 flex justify-center px-4">
              <div className={`
                 backdrop-blur-xl border px-8 py-4 rounded-2xl transition-all duration-500 transform
                 ${confidence > 70 
                    ? 'bg-blue-600/20 border-blue-500/50 translate-y-0 opacity-100 scale-100' 
                    : 'bg-black/60 border-white/10 translate-y-2 opacity-80 scale-95'}
              `}>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Détection</p>
                    <div className="text-3xl md:text-4xl font-bold text-white whitespace-nowrap min-w-[150px] text-center">
                      {currentGesture}
                    </div>
                  </div>
                  {confidence > 0 && (
                     <div className="h-10 w-px bg-white/20"></div>
                  )}
                  {confidence > 0 && (
                    <div className="text-center">
                        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Confiance</p>
                        <span className={`text-xl font-bold ${confidence > 90 ? 'text-green-400' : 'text-blue-400'}`}>
                        {Math.round(confidence)}%
                        </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-center gap-4">
             <button 
                onClick={() => setIsMicOn(!isMicOn)}
                className={`p-4 rounded-2xl transition-all ${isMicOn ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'}`}
             >
                {isMicOn ? <Mic /> : <MicOff />}
             </button>
             <button 
                onClick={() => setIsCameraOn(!isCameraOn)}
                className={`p-4 rounded-2xl transition-all ${isCameraOn ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20' : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'}`}
             >
                {isCameraOn ? <Video /> : <VideoOff />}
             </button>
          </div>
        </div>

        <div className="w-80 md:w-96 bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl z-20">
          <div className="p-5 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <h2 className="font-bold text-lg flex items-center gap-2">
               <MessageSquare className="w-5 h-5 text-blue-500" />
               Discussion en direct
            </h2>
            <p className="text-xs text-slate-500 mt-1">Les gestes détectés apparaissent ici</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
                <div className="text-center text-slate-500 mt-10 p-4 border border-dashed border-slate-700 rounded-xl">
                    <p>Aucun message encore.</p>
                    <p className="text-sm mt-2">Faites un geste pour commencer ! 👋</p>
                </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.user === username ? 'items-end' : 'items-start'}`}>
                 <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-400">{msg.user}</span>
                    <span className="text-[10px] text-slate-600">{msg.time}</span>
                 </div>
                 <div className={`
                    p-3 rounded-2xl max-w-[90%] text-sm relative group
                    ${msg.isGesture 
                        ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-blue-100' 
                        : 'bg-slate-800 border border-slate-700 text-slate-200'}
                 `}>
                    {msg.isGesture && (
                        <span className="absolute -top-2 -right-2 bg-blue-500 text-[10px] px-1.5 py-0.5 rounded-full text-white font-bold shadow-sm">
                            IA
                        </span>
                    )}
                    {msg.text}
                 </div>
                 {msg.isGesture && (
                    <span className="text-[10px] text-blue-500/60 mt-1 px-1">Confiance: {Math.round(msg.confidence)}%</span>
                 )}
              </div>
            ))}
          </div>
          
          <div className="p-4 bg-slate-900 border-t border-slate-800">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Écrire un message..."
                className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && e.target.value) {
                    sendMessage(e.target.value);
                    e.target.value = '';
                  }
                }}
              />
              <button className="p-3 bg-blue-600 hover:bg-blue-500 rounded-xl transition shadow-lg shadow-blue-900/20">
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignLanguageMeet;