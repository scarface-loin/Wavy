const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const cors = require('cors');
const url = require('url');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Stockage des salles
const rooms = new Map();

class Room {
  constructor(roomId) {
    this.roomId = roomId;
    this.participants = new Map();
    this.messages = [];
    this.createdAt = Date.now();
  }

  addParticipant(ws, username) {
    const userId = Math.random().toString(36).substr(2, 9);
    this.participants.set(ws, { username, userId, joinedAt: Date.now() });
    console.log(`✅ ${username} rejoint ${this.roomId} (${this.participants.size} participants)`);
    return userId;
  }

  removeParticipant(ws) {
    const participant = this.participants.get(ws);
    if (participant) {
      console.log(`👋 ${participant.username} quitte ${this.roomId}`);
    }
    this.participants.delete(ws);
    
    if (this.participants.size === 0) {
      rooms.delete(this.roomId);
      console.log(`🗑️ Salle ${this.roomId} supprimée (vide)`);
    }
  }

  broadcast(message, excludeWs = null) {
    this.participants.forEach((participant, ws) => {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(message));
        } catch (error) {
          console.error('Erreur broadcast:', error);
        }
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
wss.on('connection', (ws, req) => {
  console.log('🔌 Nouvelle connexion WebSocket');
  
  // Extraire le roomId de l'URL si présent
  const pathname = url.parse(req.url).pathname;
  const pathParts = pathname.split('/');
  let urlRoomId = null;
  
  // Format: /room/ABC123
  if (pathParts[1] === 'room' && pathParts[2]) {
    urlRoomId = pathParts[2].toUpperCase();
  }
  
  let currentRoom = null;
  let currentUsername = null;
  let currentUserId = null;

  // Si roomId dans l'URL, on l'enregistre (mais on attend quand même le message 'join')
  if (urlRoomId) {
    console.log(`📡 Connexion pour la salle: ${urlRoomId}`);
  }

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
          
        default:
          console.log('⚠️ Type inconnu:', data.type);
      }
    } catch (error) {
      console.error('❌ Erreur parsing:', error);
    }
  });

  ws.on('close', () => {
    if (currentRoom) {
      const room = rooms.get(currentRoom);
      if (room) {
        room.removeParticipant(ws);
        
        room.broadcast({
          type: 'participant_left',
          username: currentUsername,
          userId: currentUserId,
          participants: room.getParticipantsList()
        });
      }
    }
  });

  ws.on('error', (error) => {
    console.error('❌ Erreur WebSocket:', error);
  });

  function handleJoin(ws, data) {
    const { roomId, username } = data;
    
    if (!roomId || !username) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'roomId et username requis' 
      }));
      return;
    }

    const normalizedRoomId = roomId.toUpperCase();

    // Créer ou récupérer la salle
    if (!rooms.has(normalizedRoomId)) {
      rooms.set(normalizedRoomId, new Room(normalizedRoomId));
      console.log(`🆕 Nouvelle salle: ${normalizedRoomId}`);
    }

    const room = rooms.get(normalizedRoomId);
    const userId = room.addParticipant(ws, username);
    
    currentRoom = normalizedRoomId;
    currentUsername = username;
    currentUserId = userId;

    // Envoyer l'historique des messages
    ws.send(JSON.stringify({
      type: 'history',
      messages: room.messages.slice(-20) // Derniers 20 messages
    }));

    // Confirmer la connexion
    ws.send(JSON.stringify({
      type: 'joined',
      roomId: normalizedRoomId,
      userId,
      participants: room.getParticipantsList()
    }));

    // Notifier les autres
    room.broadcast({
      type: 'participant_joined',
      username,
      userId,
      participants: room.getParticipantsList()
    }, ws);

    console.log(`✨ Salle ${normalizedRoomId}: ${room.participants.size} participant(s)`);
  }

  function handleGesture(ws, data) {
    if (!currentRoom) {
      console.log('⚠️ Geste reçu sans salle active');
      return;
    }

    const room = rooms.get(currentRoom);
    if (!room) return;

    const gestureMessage = {
      type: 'gesture',
      username: currentUsername,
      gesture: data.gesture,
      confidence: data.confidence,
      timestamp: Date.now()
    };

    // Sauvegarder dans l'historique
    room.messages.push(gestureMessage);
    if (room.messages.length > 100) {
      room.messages.shift();
    }

    // Diffuser à tous
    room.broadcast(gestureMessage);
    
    console.log(`🤟 [${currentRoom}] ${currentUsername}: ${data.gesture} (${data.confidence}%)`);
  }

  function handleMessage(ws, data) {
    if (!currentRoom) {
      console.log('⚠️ Message reçu sans salle active');
      return;
    }

    const room = rooms.get(currentRoom);
    if (!room) return;

    const textMessage = {
      type: 'message',
      username: currentUsername,
      message: data.message,
      timestamp: Date.now()
    };

    room.messages.push(textMessage);
    if (room.messages.length > 100) {
      room.messages.shift();
    }

    room.broadcast(textMessage);
    
    console.log(`💬 [${currentRoom}] ${currentUsername}: ${data.message}`);
  }
});

// API REST
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
      createdAt: new Date(room.createdAt).toISOString()
    });
  });

  res.json(stats);
});

app.get('/api/room/:roomId', (req, res) => {
  const roomId = req.params.roomId.toUpperCase();
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ 
      error: 'Salle non trouvée',
      roomId 
    });
  }

  res.json({
    roomId: room.roomId,
    participants: room.getParticipantsList(),
    messageCount: room.messages.length,
    createdAt: new Date(room.createdAt).toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    rooms: rooms.size,
    timestamp: new Date().toISOString()
  });
});

// Page d'accueil basique
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Wavy Server</title>
        <style>
          body {
            font-family: system-ui;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #0f172a;
            color: #e2e8f0;
          }
          .status {
            background: #1e293b;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
          }
          .badge {
            background: #22c55e;
            color: white;
            padding: 5px 10px;
            border-radius: 5px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <h1>🤟 Wavy WebSocket Server</h1>
        <div class="status">
          <p><span class="badge">ONLINE</span></p>
          <p>Salles actives: <strong>${rooms.size}</strong></p>
          <p>Uptime: <strong>${Math.floor(process.uptime())}s</strong></p>
        </div>
        <h3>Endpoints disponibles:</h3>
        <ul>
          <li><code>ws://[HOST]/room/[ROOM_ID]</code> - Connexion WebSocket</li>
          <li><code>/api/stats</code> - Statistiques</li>
          <li><code>/api/room/:roomId</code> - Info d'une salle</li>
          <li><code>/health</code> - Health check</li>
        </ul>
      </body>
    </html>
  `);
});

// Nettoyage automatique (salles vides depuis 2h)
setInterval(() => {
  const now = Date.now();
  const maxAge = 2 * 60 * 60 * 1000;
  
  rooms.forEach((room, roomId) => {
    if (room.participants.size === 0 && (now - room.createdAt) > maxAge) {
      rooms.delete(roomId);
      console.log(`🧹 Nettoyage: ${roomId}`);
    }
  });
}, 30 * 60 * 1000);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║                                           ║
║        🤟  WAVY SERVER STARTED            ║
║                                           ║
║   WebSocket: ws://localhost:${PORT}         ║
║   HTTP API:  http://localhost:${PORT}       ║
║                                           ║
╚═══════════════════════════════════════════╝
  `);
});

module.exports = { app, server, wss };