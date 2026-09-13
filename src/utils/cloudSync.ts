import { LocationItem, LocationStatus } from '../types';

export type CloudSyncStatus = 'connected' | 'connecting' | 'offline';

export interface SyncMessage {
  type: 'UPDATE_STATUS' | 'REPLACE_ALL' | 'REQUEST_SYNC' | 'SYNC_RESPONSE' | 'DELETE_ITEM';
  senderId: string;
  roomId: string;
  timestamp: number;
  payload?: any;
}

const ROOM_STORAGE_KEY = 'bodega_sync_room_id';
const CLIENT_ID = `client_${Math.random().toString(36).substring(2, 9)}`;

/**
 * Obtiene o crea un identificador único de sala para sincronizar este PC con el Celular
 */
export function getOrCreateRoomId(): string {
  if (typeof window === 'undefined') return 'bodega_default';

  // 1. Si viene en la URL (?room=XYZ)
  const urlParams = new URLSearchParams(window.location.search);
  const queryRoom = urlParams.get('room');
  if (queryRoom && queryRoom.trim()) {
    const clean = queryRoom.trim();
    localStorage.setItem(ROOM_STORAGE_KEY, clean);
    return clean;
  }

  // 2. Si ya está guardado en localStorage
  const saved = localStorage.getItem(ROOM_STORAGE_KEY);
  if (saved && saved.trim()) {
    return saved.trim();
  }

  // 3. Generar una nueva sala única (alfanumérico de 6 caracteres fácil de recordar)
  const newRoom = `bodega_${Math.random().toString(36).substring(2, 8)}`;
  localStorage.setItem(ROOM_STORAGE_KEY, newRoom);
  return newRoom;
}

export function setCustomRoomId(newRoom: string): void {
  localStorage.setItem(ROOM_STORAGE_KEY, newRoom.trim());
}

/**
 * Servicio de sincronización en tiempo real sin backend (compatible con Vercel, Cloud Run y local)
 * Utiliza WebSocket público de baja latencia + BroadcastChannel para pestañas locales
 */
export class CloudSyncService {
  private roomId: string;
  private ws: WebSocket | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private statusListeners: ((status: CloudSyncStatus) => void)[] = [];
  private messageListeners: ((msg: SyncMessage) => void)[] = [];
  private reconnectTimer: any = null;
  private isDestroyed = false;
  public status: CloudSyncStatus = 'connecting';

  constructor(roomId?: string) {
    this.roomId = roomId || getOrCreateRoomId();
    this.initBroadcastChannel();
    this.connectWebSocket();
  }

  public getRoomId(): string {
    return this.roomId;
  }

  public getShareableUrl(): string {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
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
      // ignore
    }
  }

  private connectWebSocket() {
    if (this.isDestroyed) return;
    this.updateStatus('connecting');

    try {
      // Usar relay WebSocket seguro y de alta disponibilidad con CORS abierto
      // ntfy.sh admite subscripción por WebSocket directamente en wss://ntfy.sh/<topic>/ws
      const wsUrl = `wss://ntfy.sh/${this.roomId}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.updateStatus('connected');
        // Solicitar estado a otros dispositivos que ya estén en la sala
        this.sendMessage({
          type: 'REQUEST_SYNC',
          senderId: CLIENT_ID,
          roomId: this.roomId,
          timestamp: Date.now(),
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          // En ntfy.sh el payload viene en raw.message cuando raw.event === 'message'
          if (raw.event === 'message' && raw.message) {
            const parsedMsg: SyncMessage = JSON.parse(raw.message);
            if (parsedMsg && parsedMsg.senderId !== CLIENT_ID) {
              this.notifyMessage(parsedMsg);
            }
          }
        } catch {
          // Ignorar mensajes de keepalive o no JSON
        }
      };

      this.ws.onerror = () => {
        this.updateStatus('offline');
      };

      this.ws.onclose = () => {
        this.updateStatus('offline');
        if (!this.isDestroyed) {
          this.reconnectTimer = setTimeout(() => this.connectWebSocket(), 3000);
        }
      };
    } catch {
      this.updateStatus('offline');
      if (!this.isDestroyed) {
        this.reconnectTimer = setTimeout(() => this.connectWebSocket(), 4000);
      }
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
   * Envía un mensaje hacia todos los dispositivos de la misma sala (PC y Celular)
   */
  public sendMessage(msg: SyncMessage) {
    const payloadStr = JSON.stringify(msg);

    // 1. Enviar por BroadcastChannel local (otras pestañas)
    try {
      this.broadcastChannel?.postMessage(msg);
    } catch {
      // ignore
    }

    // 2. Enviar por HTTPS POST hacia el relay WebSocket (dispositivos remotos como el celular)
    try {
      fetch(`https://ntfy.sh/${this.roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: payloadStr,
        keepalive: true,
      }).catch(() => {
        // En caso de corte momentáneo de red
      });
    } catch {
      // ignore
    }
  }

  /**
   * Celular marca una ubicación -> Notifica al PC al instante
   */
  public broadcastStatusUpdate(id: string, status: LocationStatus) {
    this.sendMessage({
      type: 'UPDATE_STATUS',
      senderId: CLIENT_ID,
      roomId: this.roomId,
      timestamp: Date.now(),
      payload: {
        id,
        status,
        countedAt: status !== 'pendiente' ? new Date().toISOString() : undefined,
      },
    });
  }

  /**
   * PC carga un nuevo listado -> Notifica al Celular al instante
   */
  public broadcastReplaceAll(locations: LocationItem[]) {
    this.sendMessage({
      type: 'REPLACE_ALL',
      senderId: CLIENT_ID,
      roomId: this.roomId,
      timestamp: Date.now(),
      payload: { locations },
    });
  }

  /**
   * Responde a una solicitud de sincronización con la lista actual
   */
  public sendSyncResponse(locations: LocationItem[]) {
    this.sendMessage({
      type: 'SYNC_RESPONSE',
      senderId: CLIENT_ID,
      roomId: this.roomId,
      timestamp: Date.now(),
      payload: { locations },
    });
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
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
  }
}
