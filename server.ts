import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

// In-memory store for warehouse locations
// Shared between all devices (PC, mobile) connected to this instance
interface LocationItem {
  id: string;
  code: string;
  nivel: string;
  columna: string;
  estanteria: string;
  posicion: string;
  status: 'pendiente' | 'vacia' | 'llena';
  countedAt?: string;
}

let storedLocations: LocationItem[] = [
  { id: '1', code: 'N1C01EAP1', nivel: '1', columna: '01', estanteria: 'A', posicion: '1', status: 'pendiente' },
  { id: '2', code: 'N1C01EAP2', nivel: '1', columna: '01', estanteria: 'A', posicion: '2', status: 'pendiente' },
  { id: '3', code: 'N1C01EBP1', nivel: '1', columna: '01', estanteria: 'B', posicion: '1', status: 'pendiente' },
  { id: '4', code: 'N1C02EAP1', nivel: '1', columna: '02', estanteria: 'A', posicion: '1', status: 'pendiente' },
  { id: '5', code: 'N1C02EAP2', nivel: '1', columna: '02', estanteria: 'A', posicion: '2', status: 'pendiente' },
  { id: '6', code: 'N2C01EAP1', nivel: '2', columna: '01', estanteria: 'A', posicion: '1', status: 'pendiente' },
  { id: '7', code: 'N2C01EAP2', nivel: '2', columna: '01', estanteria: 'A', posicion: '2', status: 'pendiente' },
  { id: '8', code: 'N2C02EAP1', nivel: '2', columna: '02', estanteria: 'A', posicion: '1', status: 'pendiente' },
  { id: '9', code: 'N2C02EBP1', nivel: '2', columna: '02', estanteria: 'B', posicion: '1', status: 'pendiente' },
  { id: '10', code: 'N3C01EAP1', nivel: '3', columna: '01', estanteria: 'A', posicion: '1', status: 'pendiente' },
  { id: '11', code: 'N3C01EAP2', nivel: '3', columna: '01', estanteria: 'A', posicion: '2', status: 'pendiente' },
  { id: '12', code: 'N3C02EBP1', nivel: '3', columna: '02', estanteria: 'B', posicion: '1', status: 'pendiente' },
];

let lastModified = Date.now();

// SSE (Server-Sent Events) clients registry for live sync
type SseClient = {
  id: string;
  res: express.Response;
};

const sseClients: SseClient[] = [];

function broadcastUpdate(type: string, data?: any) {
  lastModified = Date.now();
  const payload = JSON.stringify({
    type,
    lastModified,
    locations: storedLocations,
    ...data,
  });

  for (let i = sseClients.length - 1; i >= 0; i--) {
    const client = sseClients[i];
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', lastModified, count: storedLocations.length });
});

// SSE endpoint for instant live sync between PC and Mobile
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const client: SseClient = { id: clientId, res };
  sseClients.push(client);

  // Send initial data immediately
  res.write(`data: ${JSON.stringify({ type: 'init', lastModified, locations: storedLocations })}\n\n`);

  req.on('close', () => {
    const idx = sseClients.findIndex(c => c.id === clientId);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// GET all locations
app.get('/api/locations', (req, res) => {
  res.json({
    success: true,
    lastModified,
    locations: storedLocations,
  });
});

// POST replace all locations (when PC uploads an Excel or pastes a list)
app.post('/api/locations', (req, res) => {
  const { locations } = req.body;
  if (!Array.isArray(locations)) {
    return res.status(400).json({ error: 'Formato inválido. Se espera arreglo "locations"' });
  }

  storedLocations = locations;
  broadcastUpdate('replace_all');
  res.json({ success: true, count: storedLocations.length, lastModified });
});

// PATCH update single location status (when Mobile marks Vacía or Llena)
app.patch('/api/locations/:id', (req, res) => {
  const { id } = req.params;
  const { status, countedAt } = req.body;

  const target = storedLocations.find(l => l.id === id);
  if (!target) {
    return res.status(404).json({ error: 'Ubicación no encontrada' });
  }

  target.status = status;
  target.countedAt = countedAt || (status !== 'pendiente' ? new Date().toISOString() : undefined);

  broadcastUpdate('update_item', { updatedItem: target });
  res.json({ success: true, item: target, lastModified });
});

// PUT update single location data (for editing N, C, E, P)
app.put('/api/locations/:id', (req, res) => {
  const { id } = req.params;
  const { code, nivel, columna, estanteria, posicion } = req.body;

  const target = storedLocations.find(l => l.id === id);
  if (!target) {
    return res.status(404).json({ error: 'Ubicación no encontrada' });
  }

  target.code = code;
  target.nivel = nivel;
  target.columna = columna;
  target.estanteria = estanteria;
  target.posicion = posicion;

  broadcastUpdate('edit_item', { updatedItem: target });
  res.json({ success: true, item: target, lastModified });
});

// DELETE single location
app.delete('/api/locations/:id', (req, res) => {
  const { id } = req.params;
  const initialLength = storedLocations.length;
  storedLocations = storedLocations.filter(l => l.id !== id);

  if (storedLocations.length === initialLength) {
    return res.status(404).json({ error: 'Ubicación no encontrada' });
  }

  broadcastUpdate('delete_item', { deletedId: id });
  res.json({ success: true, count: storedLocations.length, lastModified });
});

// DELETE bulk or all locations
app.delete('/api/locations', (req, res) => {
  const { ids } = req.body || {};
  if (Array.isArray(ids) && ids.length > 0) {
    const idSet = new Set(ids);
    storedLocations = storedLocations.filter(l => !idSet.has(l.id));
  } else {
    storedLocations = [];
  }

  broadcastUpdate('bulk_delete');
  res.json({ success: true, count: storedLocations.length, lastModified });
});

// ----------------------------------------------------
// VITE MIDDLEWARE & SERVER STARTUP
// ----------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
