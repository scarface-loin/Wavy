const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Stockage des salles et participants
const rooms = new Map();

// Structure d'une salle
class Room {
  constructor(roomId) {
    this.roomId = roomId;
    this.participants = new Map(); // Map<ws, {username, userId}>
    this.messages = [];
    this.createdAt = Date.now();
  }

  addParticipant(ws, username) {
    const userId = Math.random().toString(36).substr(2, 9);
    this.participants.set(ws, { username, userId });
    return userId;
  }

  removeParticipant(ws) {
    this.participants.delete(ws);
    
    // Supprimer la salle si vide
    if (this.participants.size === 0) {
      rooms.delete(this.roomId);
      console.log(`🗑️ Salle ${this.roomId} supprimée (vide)`);
    }
  }

  broadcast(message, excludeWs = null) {
    this.participants.forEach((participant, ws) => {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  getParticipantsList() {
    const list = [];
    this.participants.forEach((participant) => {
      list.push({
        username: participant.username,
        userId: participant.userId
      });
    });
    return list;
  }
}

// Gestion des connexions WebSocket
wss.on('connection', (ws) => {
  console.log('🔌 Nouvelle connexion WebSocket');
  
  let currentRoom = null;
  let currentUsername = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'join':
          handleJoin(ws, data);
          break;
          
        case 'gesture':
          handleGesture(ws, data);
          break;
          
        case 'message':
          handleMessage(ws, data);
          break;
          
        case 'signal':
          handleSignal(ws, data);
          break;
          
        default:
          console.log('Type de message inconnu:', data.type);
      }
    } catch (error) {
      console.error('Erreur parsing message:', error);
    }
  });

  ws.on('close', () => {
    if (currentRoom) {
      const room = rooms.get(currentRoom);
      if (room) {
        room.removeParticipant(ws);
        
        // Notifier les autres participants
        room.broadcast({
          type: 'participant_left',
          username: currentUsername,
          participants: room.getParticipantsList()
        });
        
        console.log(`👋 ${currentUsername} a quitté la salle ${currentRoom}`);
      }
    }
  });

  ws.on('error', (error) => {
    console.error('Erreur WebSocket:', error);
  });

  // Handler: Rejoindre une salle
  function handleJoin(ws, data) {
    const { roomId, username } = data;
    
    if (!roomId || !username) {
      ws.send(JSON.stringify({ type: 'error', message: 'roomId et username requis' }));
      return;
    }

    // Créer ou récupérer la salle
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Room(roomId));
      console.log(`🆕 Nouvelle salle créée: ${roomId}`);
    }

    const room = rooms.get(roomId);
    const userId = room.addParticipant(ws, username);
    
    currentRoom = roomId;
    currentUsername = username;

    // Confirmer la connexion
    ws.send(JSON.stringify({
      type: 'joined',
      roomId,
      userId,
      participants: room.getParticipantsList()
    }));

    // Notifier les autres participants
    room.broadcast({
      type: 'participant_joined',
      username,
      userId,
      participants: room.getParticipantsList()
    }, ws);

    console.log(`✅ ${username} a rejoint la salle ${roomId} (${room.participants.size} participants)`);
  }

  // Handler: Geste détecté
  function handleGesture(ws, data) {
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (!room) return;

    const gestureMessage = {
      type: 'gesture',
      username: data.username || currentUsername,
      gesture: data.gesture,
      confidence: data.confidence,
      timestamp: Date.now()
    };

    // Sauvegarder dans l'historique
    room.messages.push(gestureMessage);
    
    // Limiter l'historique à 100 messages
    if (room.messages.length > 100) {
      room.messages.shift();
    }

    // Diffuser à tous les participants
    room.broadcast(gestureMessage);
    
    console.log(`🤟 ${currentUsername}: ${data.gesture} (${data.confidence}%)`);
  }

  // Handler: Message texte
  function handleMessage(ws, data) {
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (!room) return;

    const textMessage = {
      type: 'message',
      username: data.username || currentUsername,
      message: data.message,
      timestamp: Date.now()
    };

    room.messages.push(textMessage);
    
    if (room.messages.length > 100) {
      room.messages.shift();
    }

    room.broadcast(textMessage);
    
    console.log(`💬 ${currentUsername}: ${data.message}`);
  }

  // Handler: Signal WebRTC (pour future implémentation vidéo P2P)
  function handleSignal(ws, data) {
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (!room) return;

    // Transférer le signal au destinataire
    room.participants.forEach((participant, participantWs) => {
      if (participant.userId === data.to && participantWs.readyState === WebSocket.OPEN) {
        participantWs.send(JSON.stringify({
          type: 'signal',
          from: data.from,
          signal: data.signal
        }));
      }
    });
  }
});

// API REST pour stats
app.get('/api/stats', (req, res) => {
  const stats = {
    totalRooms: rooms.size,
    totalParticipants: 0,
    rooms: []
  };

  rooms.forEach((room, roomId) => {
    stats.totalParticipants += room.participants.size;
    stats.rooms.push({
      roomId,
      participants: room.participants.size,
      messages: room.messages.length,
      createdAt: room.createdAt
    });
  });

  res.json(stats);
});

app.get('/api/room/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Salle non trouvée' });
  }

  res.json({
    roomId: room.roomId,
    participants: room.getParticipantsList(),
    messageCount: room.messages.length,
    createdAt: room.createdAt
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    rooms: rooms.size 
  });
});

// Nettoyage automatique des salles inactives (plus de 2 heures)
setInterval(() => {
  const now = Date.now();
  const maxAge = 2 * 60 * 60 * 1000; // 2 heures
  
  rooms.forEach((room, roomId) => {
    if (room.participants.size === 0 && (now - room.createdAt) > maxAge) {
      rooms.delete(roomId);
      console.log(`🧹 Salle ${roomId} nettoyée (inactive)`);
    }
  });
}, 30 * 60 * 1000); // Toutes les 30 minutes

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   SignLanguage Meet Server             ║
║   WebSocket: ws://localhost:${PORT}      ║
║   HTTP API: http://localhost:${PORT}     ║
╚════════════════════════════════════════╝
  `);
});

module.exports = { app, server, wss };