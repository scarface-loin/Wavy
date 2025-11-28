import React, { useState, useEffect, useRef } from 'react';
import { Camera, Users, Copy, Check, LogOut, Send, Mic, MicOff, Video, VideoOff, Phone } from 'lucide-react';

const SignLanguageMeet = () => {
    const [roomId, setRoomId] = useState('');
    const [username, setUsername] = useState('');
    const [isInRoom, setIsInRoom] = useState(false);
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
    const animationRef = useRef(null);

    // Initialisation MediaPipe Hands
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
        script.async = true;
        script.onload = () => {
            const script2 = document.createElement('script');
            script2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
            script2.async = true;
            script2.onload = () => {
                const script3 = document.createElement('script');
                script3.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js';
                script3.async = true;
                document.body.appendChild(script3);
            };
            document.body.appendChild(script2);
        };
        document.body.appendChild(script);
    }, []);

    // Fonction de reconnaissance de gestes
    const recognizeGesture = (landmarks) => {
        if (!landmarks || landmarks.length === 0) return { word: '...', conf: 0 };

        const fingers = [];

        // Pouce
        if (Math.abs(landmarks[4].x - landmarks[17].x) > Math.abs(landmarks[3].x - landmarks[17].x)) {
            fingers.push(1);
        } else {
            fingers.push(0);
        }

        // Autres doigts
        const tips = [8, 12, 16, 20];
        const pips = [6, 10, 14, 18];

        tips.forEach((tip, i) => {
            if (landmarks[tip].y < landmarks[pips[i]].y) {
                fingers.push(1);
            } else {
                fingers.push(0);
            }
        });

        const dist = (p1, p2) => Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const thumbIndex = dist(landmarks[4], landmarks[8]);
        const indexMiddle = dist(landmarks[8], landmarks[12]);

        // Détection des gestes
        if (thumbIndex < 0.05 && fingers[2] === 1 && fingers[3] === 1 && fingers[4] === 1) {
            return { word: 'Parfait / OK', conf: 95 };
        } else if (fingers.every(f => f === 1)) {
            return indexMiddle > 0.08 ? { word: 'Cinq / Stop', conf: 92 } : { word: 'Bonjour', conf: 90 };
        } else if (fingers[0] === 0 && fingers[1] === 1 && fingers[2] === 1 && fingers[3] === 1 && fingers[4] === 1) {
            return { word: 'Merci', conf: 88 };
        } else if (fingers[1] === 1 && fingers[2] === 1 && fingers[3] === 0 && fingers[4] === 0) {
            return indexMiddle > 0.06 ? { word: 'Victoire / Paix', conf: 92 } : { word: 'Lettre U', conf: 85 };
        } else if (fingers[0] === 1 && fingers[1] === 0 && fingers[2] === 0 && fingers[3] === 0 && fingers[4] === 1) {
            return { word: 'Appelle-moi', conf: 96 };
        } else if (fingers[0] === 1 && fingers[1] === 1 && fingers[2] === 0 && fingers[3] === 0 && fingers[4] === 1) {
            return { word: 'Je t\'aime', conf: 94 };
        } else if (fingers[0] === 0 && fingers[1] === 1 && fingers[2] === 0 && fingers[3] === 0 && fingers[4] === 1) {
            return { word: 'Rock\'n Roll', conf: 91 };
        } else if (fingers[1] === 1 && fingers[2] === 0 && fingers[3] === 0 && fingers[4] === 0) {
            return { word: 'Non / Un', conf: 89 };
        } else if (fingers[0] === 1 && fingers[1] === 0 && fingers[2] === 0 && fingers[3] === 0 && fingers[4] === 0) {
            return { word: 'Super / Oui', conf: 93 };
        } else if (fingers.every(f => f === 0)) {
            return { word: 'Poing', conf: 90 };
        }

        return { word: '...', conf: 0 };
    };

    // Démarrage de la caméra et détection
    const startCamera = async () => {
        if (!window.Hands) {
            setTimeout(startCamera, 500);
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 }
            });
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            const hands = new window.Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });

            hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.5
            });

            hands.onResults((results) => {
                const canvas = canvasRef.current;
                const video = videoRef.current;

                if (canvas && video) {
                    const ctx = canvas.getContext('2d');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;

                    ctx.save();
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

                    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                        for (const landmarks of results.multiHandLandmarks) {
                            window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
                            window.drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 1, radius: 3 });

                            const gesture = recognizeGesture(landmarks);
                            setCurrentGesture(gesture.word);
                            setConfidence(gesture.conf);

                            // Envoyer aux autres participants
                            if (ws && ws.readyState === WebSocket.OPEN && gesture.conf > 70) {
                                ws.send(JSON.stringify({
                                    type: 'gesture',
                                    gesture: gesture.word,
                                    confidence: gesture.conf,
                                    username
                                }));
                            }
                        }
                    } else {
                        setCurrentGesture('...');
                        setConfidence(0);
                    }

                    ctx.restore();
                }
            });

            handsRef.current = hands;

            const camera = new window.Camera(videoRef.current, {
                onFrame: async () => {
                    if (handsRef.current && videoRef.current) {
                        await handsRef.current.send({ image: videoRef.current });
                    }
                },
                width: 1280,
                height: 720
            });

            camera.start();
        } catch (err) {
            console.error('Erreur caméra:', err);
            alert('Impossible d\'accéder à la caméra');
        }
    };

    // Création/Rejoindre une salle
    const joinRoom = () => {
        if (!roomId || !username) return;

        // Connexion WebSocket simulée (remplacer par vraie URL)
        // Utilise l'URL définie dans l'environnement, sinon localhost
        const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
        const socket = new WebSocket(`${wsUrl}/room/${roomId}`);
        socket.onopen = () => {
            socket.send(JSON.stringify({
                type: 'join',
                username,
                roomId
            }));
            setIsInRoom(true);
            startCamera();
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'participants') {
                setParticipants(data.participants);
            } else if (data.type === 'gesture') {
                setMessages(prev => [...prev, {
                    user: data.username,
                    text: data.gesture,
                    confidence: data.confidence,
                    time: new Date().toLocaleTimeString()
                }]);
            } else if (data.type === 'message') {
                setMessages(prev => [...prev, {
                    user: data.username,
                    text: data.message,
                    time: new Date().toLocaleTimeString()
                }]);
            }
        };

        socket.onclose = () => {
            setIsInRoom(false);
            stopCamera();
        };

        setWs(socket);
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }
    };

    const leaveRoom = () => {
        if (ws) {
            ws.close();
        }
        stopCamera();
        setIsInRoom(false);
        setRoomId('');
        setParticipants([]);
        setMessages([]);
    };

    const createNewRoom = () => {
        const newRoomId = Math.random().toString(36).substr(2, 9).toUpperCase();
        setRoomId(newRoomId);
    };

    const copyRoomId = () => {
        navigator.clipboard.writeText(roomId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const sendMessage = (text) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'message',
                message: text,
                username
            }));
        }
    };

    // Interface de connexion
    if (!isInRoom) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
                <div className="bg-slate-800/80 backdrop-blur-xl border border-blue-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-500/20 rounded-full mb-4">
                            <Users className="w-10 h-10 text-blue-400" />
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2">SignLanguage Meet</h1>
                        <p className="text-slate-400">Réunions en langue des signes en temps réel</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Votre nom</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Entrez votre nom"
                                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Code de la réunion</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={roomId}
                                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                                    placeholder="ABC123DEF"
                                    className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
                                />
                                <button
                                    onClick={createNewRoom}
                                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition font-medium"
                                >
                                    Créer
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={joinRoom}
                            disabled={!roomId || !username}
                            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-slate-700 disabled:to-slate-700 text-white rounded-xl font-semibold transition disabled:cursor-not-allowed"
                        >
                            Rejoindre la réunion
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Interface de la réunion
    return (
        <div className="min-h-screen bg-slate-900 flex flex-col">
            {/* Header */}
            <div className="bg-slate-800 border-b border-slate-700 p-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold text-white">SignLanguage Meet</h1>
                        <div className="flex items-center gap-2 bg-slate-700/50 px-4 py-2 rounded-lg">
                            <span className="text-slate-400 text-sm">Code:</span>
                            <span className="text-white font-mono font-bold">{roomId}</span>
                            <button onClick={copyRoomId} className="text-blue-400 hover:text-blue-300 transition">
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-slate-700/50 px-4 py-2 rounded-lg">
                            <Users className="w-4 h-4 text-blue-400" />
                            <span className="text-white text-sm">{participants.length + 1}</span>
                        </div>
                        <button
                            onClick={leaveRoom}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                        >
                            <Phone className="w-4 h-4" />
                            Quitter
                        </button>
                    </div>
                </div>
            </div>

            {/* Contenu principal */}
            <div className="flex-1 flex overflow-hidden">
                {/* Zone vidéo */}
                <div className="flex-1 p-4 flex flex-col">
                    {/* Vidéo principale */}
                    <div className="flex-1 bg-black rounded-2xl overflow-hidden relative mb-4 border-2 border-blue-500/50 shadow-2xl">
                        <video ref={videoRef} autoPlay playsInline className="hidden" />
                        <canvas ref={canvasRef} className="w-full h-full object-cover" />

                        {/* Overlay traduction */}
                        <div className="absolute bottom-6 left-6 right-6">
                            <div className="bg-black/80 backdrop-blur-xl border border-blue-500/50 rounded-2xl p-6">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-slate-400 text-sm uppercase tracking-wide">Traduction en direct</span>
                                    <span className="text-blue-400 font-bold">{confidence}%</span>
                                </div>
                                <div className="text-4xl font-bold text-white">{currentGesture}</div>
                            </div>
                        </div>

                        {/* Contrôles */}
                        <div className="absolute top-6 right-6 flex gap-2">
                            <button
                                onClick={() => setIsCameraOn(!isCameraOn)}
                                className={`p-3 rounded-full ${isCameraOn ? 'bg-slate-700/80' : 'bg-red-600'} hover:scale-110 transition`}
                            >
                                {isCameraOn ? <Video className="w-5 h-5 text-white" /> : <VideoOff className="w-5 h-5 text-white" />}
                            </button>
                            <button
                                onClick={() => setIsMicOn(!isMicOn)}
                                className={`p-3 rounded-full ${isMicOn ? 'bg-slate-700/80' : 'bg-red-600'} hover:scale-110 transition`}
                            >
                                {isMicOn ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
                            </button>
                        </div>

                        {/* Info utilisateur */}
                        <div className="absolute top-6 left-6 bg-black/80 backdrop-blur-xl px-4 py-2 rounded-full border border-blue-500/50">
                            <span className="text-white font-semibold">{username} (Vous)</span>
                        </div>
                    </div>

                    {/* Participants */}
                    <div className="grid grid-cols-4 gap-4">
                        {participants.map((p, i) => (
                            <div key={i} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                                <div className="aspect-video bg-slate-700 rounded-lg mb-2 flex items-center justify-center">
                                    <Users className="w-8 h-8 text-slate-500" />
                                </div>
                                <p className="text-white text-sm font-medium truncate">{p.username}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Chat */}
                <div className="w-96 bg-slate-800 border-l border-slate-700 flex flex-col">
                    <div className="p-4 border-b border-slate-700">
                        <h2 className="text-white font-semibold">Messages</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {messages.map((msg, i) => (
                            <div key={i} className="bg-slate-700/50 rounded-xl p-3 border border-slate-600">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-blue-400 font-semibold text-sm">{msg.user}</span>
                                    <span className="text-slate-500 text-xs">{msg.time}</span>
                                </div>
                                <p className="text-white">{msg.text}</p>
                                {msg.confidence && (
                                    <span className="text-xs text-slate-400 mt-1 block">{msg.confidence}% confiance</span>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="p-4 border-t border-slate-700">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Envoyer un message..."
                                className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && e.target.value) {
                                        sendMessage(e.target.value);
                                        e.target.value = '';
                                    }
                                }}
                            />
                            <button className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition">
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