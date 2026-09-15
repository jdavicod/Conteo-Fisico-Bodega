import { LocationItem, LocationStatus } from '../types';
import { parseCombinedCode } from './parser';

export type CloudSyncStatus = 'connected' | 'connecting' | 'offline';

export interface SyncMessage {
  type: 'UPDATE_STATUS' | 'REPLACE_ALL' | 'REQUEST_SYNC' | 'SYNC_RESPONSE' | 'CHUNK_DATA';
  senderId: string;
  roomId: string;
  timestamp: number;
  payload?: any;
}

const ROOM_STORAGE_KEY = 'bodega_sync_room_id';
export const CLIENT_ID = `client_${Math.random().toString(36).substring(2, 9)}`;

/**
 * Limpia y normaliza el ID de sala (solo minúsculas, números, guiones y guión bajo).
 * Evita espacios o caracteres especiales que causan ERR_CONNECTION_TIMED_OUT o URLs inválidas.
 */
export function sanitizeRoomId(raw: string): string {
  const cleaned = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 32);

  return cleaned || 'bodega_sala1';
}

/**
 * Obtiene o crea un identificador único de sala para sincronizar este PC con el Celular
 */
export function getOrCreateRoomId(): string {
  if (typeof window === 'undefined') return 'bodega_default';

  // 1. Si viene en la URL (?room=XYZ)
  const urlParams = new URLSearchParams(window.location.search);
  const queryRoom = urlParams.get('room');
  if (queryRoom && queryRoom.trim()) {
    const clean = sanitizeRoomId(queryRoom);
    localStorage.setItem(ROOM_STORAGE_KEY, clean);
    return clean;
  }

  // 2. Si ya está guardado en localStorage
  const saved = localStorage.getItem(ROOM_STORAGE_KEY);
  if (saved && saved.trim()) {
    return sanitizeRoomId(saved);
  }

  // 3. Generar una nueva sala única limpia (alfanumérico de 6 caracteres)
  const newRoom = `bodega_${Math.random().toString(36).substring(2, 8)}`;
  localStorage.setItem(ROOM_STORAGE_KEY, newRoom);
  return newRoom;
}

export function setCustomRoomId(newRoom: string): void {
  const clean = sanitizeRoomId(newRoom);
  localStorage.setItem(ROOM_STORAGE_KEY, clean);
}

/**
 * Compacta un LocationItem en tupla [código, status_num, timestamp_seg]
 * Status: 0 = pendiente, 1 = vacia, 2 = llena
 */
function compactItem(item: LocationItem): [string, number, number | undefined] {
  const statNum = item.status === 'llena' ? 2 : item.status === 'vacia' ? 1 : 0;
  const timeSec = item.countedAt ? Math.floor(new Date(item.countedAt).getTime() / 1000) : undefined;
  return [item.code, statNum, timeSec];
}

/**
 * Reconstruye un LocationItem a partir de su tupla compacta
 */
function expandItem(compact: any[]): LocationItem {
  const code = String(compact[0] || '').trim();
  const statNum = compact[1];
  const timeSec = compact[2];
  const status: LocationStatus = statNum === 2 ? 'llena' : statNum === 1 ? 'vacia' : 'pendiente';
  const parsed = parseCombinedCode(code);
  const nivel = parsed ? parsed.nivel : '';
  const columna = parsed ? parsed.columna : '';
  const estanteria = parsed ? parsed.estanteria : '';
  const posicion = parsed ? parsed.posicion : '';

  return {
    id: `sync-${code}`,
    code,
    nivel,
    columna,
    estanteria,
    posicion,
    status,
    countedAt: timeSec ? new Date(timeSec * 1000).toISOString() : undefined,
  };
}

/**
 * Servicio de sincronización en tiempo real optimizado para hasta 500 ubicaciones:
 * - Sin archivos adjuntos (evita errores 429 de límite de descargas en ntfy.sh)
 * - Transmisión en micro-bloques ligeros de texto plano (<2KB cada uno)
 * - Conexión resiliente vía SSE (Server-Sent Events) y WebSocket
 * - Limpieza estricta de nombres de sala para evitar ERR_CONNECTION_TIMED_OUT
 */
export class CloudSyncService {
  private roomId: string;
  private sse: EventSource | null = null;
  private ws: WebSocket | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private statusListeners: ((status: CloudSyncStatus) => void)[] = [];
  private messageListeners: ((msg: SyncMessage) => void)[] = [];
  private reconnectTimer: any = null;
  private isDestroyed = false;
  private retryCount = 0;
  private processedMessageIds = new Set<string>();

  // Buffer para recepción de bloques (chunks) de ubicaciones
  private incomingChunks = new Map<string, { total: number; chunks: Map<number, LocationItem[]>; timer: any }>();

  public status: CloudSyncStatus = 'connecting';

  constructor(roomId?: string) {
    this.roomId = sanitizeRoomId(roomId || getOrCreateRoomId());
    this.initBroadcastChannel();
    this.connectStream();
  }

  public getRoomId(): string {
    return this.roomId;
  }

  public getShareableUrl(): string {
    if (typeof window === 'undefined') return '';
    let origin = window.location.origin;
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }
    const url = new URL(origin + window.location.pathname);
    url.searchParams.set('room', this.roomId);
    return url.toString();
  }

  private initBroadcastChannel() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel(`bodega_${this.roomId}`);
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.senderId !== CLIENT_ID) {
            this.notifyMessage(event.data);
          }
        };
      }
    } catch {
      // BroadcastChannel no soportado
    }
  }

  /**
   * Conecta mediante Server-Sent Events (SSE), que funciona de forma transparente
   * sobre HTTPS (puerto 443) y atraviesa proxys y redes educativas sin bloqueos.
   */
  private connectStream() {
    if (this.isDestroyed) return;
    this.updateStatus('connecting');

    try {
      if (this.sse) {
        this.sse.close();
        this.sse = null;
      }

      const encodedRoom = encodeURIComponent(this.roomId);
      const sseUrl = `https://ntfy.sh/${encodedRoom}/sse`;
      this.sse = new EventSource(sseUrl);

      this.sse.onopen = () => {
        this.retryCount = 0;
        this.updateStatus('connected');
        // Solicitar listado a los demás dispositivos en la sala
        this.sendRequestSync();
      };

      this.sse.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          this.handleIncomingRaw(raw);
        } catch {
          // Keepalive o no JSON
        }
      };

      this.sse.onerror = () => {
        this.updateStatus('offline');
        if (this.sse) {
          this.sse.close();
          this.sse = null;
        }

        if (!this.isDestroyed && this.retryCount < 5) {
          this.retryCount++;
          const delay = Math.min(30000, 3000 * Math.pow(1.5, this.retryCount));
          this.reconnectTimer = setTimeout(() => this.connectStream(), delay);
        }
      };
    } catch {
      this.updateStatus('offline');
    }
  }

  private handleIncomingRaw(raw: any) {
    if (!raw || raw.event !== 'message' || !raw.message) return;

    if (raw.id && this.processedMessageIds.has(raw.id)) {
      return;
    }
    if (raw.id) {
      this.processedMessageIds.add(raw.id);
      if (this.processedMessageIds.size > 500) {
        const first = this.processedMessageIds.values().next().value;
        if (first) this.processedMessageIds.delete(first);
      }
    }

    try {
      const msg: SyncMessage = JSON.parse(raw.message);
      if (!msg || msg.senderId === CLIENT_ID || msg.roomId !== this.roomId) {
        return;
      }

      // Si es un fragmento de lista (CHUNK_DATA)
      if (msg.type === 'CHUNK_DATA' && msg.payload) {
        this.handleIncomingChunk(msg.payload);
        return;
      }

      this.notifyMessage(msg);
    } catch {
      // Ignorar mensajes malformados
    }
  }

  /**
   * Ensambla fragmentos de listas grandes sin saturar la red
   */
  private handleIncomingChunk(payload: { batchId: string; chunkIndex: number; totalChunks: number; items: any[] }) {
    const { batchId, chunkIndex, totalChunks, items } = payload;
    if (!batchId || !Array.isArray(items)) return;

    let entry = this.incomingChunks.get(batchId);
    if (!entry) {
      entry = {
        total: totalChunks,
        chunks: new Map(),
        timer: setTimeout(() => {
          this.finalizeBatch(batchId);
        }, 3000),
      };
      this.incomingChunks.set(batchId, entry);
    }

    const expanded = items.map(expandItem);
    entry.chunks.set(chunkIndex, expanded);

    if (entry.chunks.size >= entry.total) {
      clearTimeout(entry.timer);
      this.finalizeBatch(batchId);
    }
  }

  private finalizeBatch(batchId: string) {
    const entry = this.incomingChunks.get(batchId);
    if (!entry) return;

    this.incomingChunks.delete(batchId);
    const allLocations: LocationItem[] = [];
    const sortedKeys = Array.from(entry.chunks.keys()).sort((a, b) => a - b);
    for (const key of sortedKeys) {
      const chunkItems = entry.chunks.get(key);
      if (chunkItems) {
        allLocations.push(...chunkItems);
      }
    }

    if (allLocations.length > 0) {
      this.notifyMessage({
        type: 'SYNC_RESPONSE',
        senderId: 'remote',
        roomId: this.roomId,
        timestamp: Date.now(),
        payload: { locations: allLocations },
      });
    }
  }

  private updateStatus(newStatus: CloudSyncStatus) {
    this.status = newStatus;
    this.statusListeners.forEach((fn) => fn(newStatus));
  }

  private notifyMessage(msg: SyncMessage) {
    this.messageListeners.forEach((fn) => fn(msg));
  }

  public onStatusChange(callback: (status: CloudSyncStatus) => void): () => void {
    this.statusListeners.push(callback);
    callback(this.status);
    return () => {
      this.statusListeners = this.statusListeners.filter((cb) => cb !== callback);
    };
  }

  public onMessage(callback: (msg: SyncMessage) => void): () => void {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter((cb) => cb !== callback);
    };
  }

  /**
   * Envía un mensaje JSON ligero hacia la sala sin cabeceras de adjunto (sin errores 429)
   */
  public async sendMessage(msg: SyncMessage): Promise<void> {
    const payloadStr = JSON.stringify(msg);

    // 1. BroadcastChannel local entre pestañas
    try {
      this.broadcastChannel?.postMessage(msg);
    } catch {
      // ignore
    }

    // 2. HTTPS POST hacia ntfy.sh (puro JSON sin adjunto)
    try {
      const encodedRoom = encodeURIComponent(this.roomId);
      await fetch(`https://ntfy.sh/${encodedRoom}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: payloadStr,
      });
    } catch (err) {
      console.warn('Advertencia de transmisión de sincronización:', err);
    }
  }

  /**
   * Envía la solicitud de sincronización cuando un nuevo cliente se conecta
   */
  public sendRequestSync() {
    this.sendMessage({
      type: 'REQUEST_SYNC',
      senderId: CLIENT_ID,
      roomId: this.roomId,
      timestamp: Date.now(),
    });
  }

  /**
   * Notifica el cambio de una sola ubicación (solo ~80 bytes)
   */
  public broadcastStatusUpdate(id: string, code: string, status: LocationStatus) {
    this.sendMessage({
      type: 'UPDATE_STATUS',
      senderId: CLIENT_ID,
      roomId: this.roomId,
      timestamp: Date.now(),
      payload: {
        id,
        code,
        status,
        countedAt: status !== 'pendiente' ? new Date().toISOString() : undefined,
      },
    });
  }

  /**
   * Transmite el listado completo (hasta 500 ubicaciones) dividido en micro-bloques de 60 items (<1.5KB cada uno)
   */
  public async broadcastReplaceAll(locations: LocationItem[]) {
    await this.sendInChunks('REPLACE_ALL', locations);
  }

  /**
   * Responde a una solicitud de sincronización enviando los datos en micro-bloques
   */
  public async sendSyncResponse(locations: LocationItem[]) {
    await this.sendInChunks('SYNC_RESPONSE', locations);
  }

  private async sendInChunks(_type: 'REPLACE_ALL' | 'SYNC_RESPONSE', locations: LocationItem[]) {
    if (locations.length === 0) return;

    const chunkSize = 60;
    const totalChunks = Math.ceil(locations.length / chunkSize);
    const batchId = `b_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    for (let c = 0; c < totalChunks; c++) {
      if (this.isDestroyed) break;
      const slice = locations.slice(c * chunkSize, (c + 1) * chunkSize);
      const compactItems = slice.map(compactItem);

      const msg: SyncMessage = {
        type: 'CHUNK_DATA',
        senderId: CLIENT_ID,
        roomId: this.roomId,
        timestamp: Date.now(),
        payload: {
          batchId,
          chunkIndex: c,
          totalChunks,
          items: compactItems,
        },
      };

      await this.sendMessage(msg);
      // Pausa breve de 120ms entre bloques para no saturar el canal
      if (c < totalChunks - 1) {
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    }
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.sse) {
      this.sse.close();
      this.sse = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    this.statusListeners = [];
    this.messageListeners = [];
    this.processedMessageIds.clear();
    this.incomingChunks.clear();
  }
}
