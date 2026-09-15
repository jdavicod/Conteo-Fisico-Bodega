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
export const CLIENT_ID = `client_${Math.random().toString(36).substring(2, 9)}`;

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
 * Servicio de sincronización en tiempo real de alta escalabilidad (1.000+ ubicaciones)
 * - Soporta mensajes de cualquier tamaño mediante attachments automáticos con CORS abierto
 * - Polling de historial (?poll=1) para que el celular reciba datos incluso si el PC se conectó antes
 * - BroadcastChannel local para sincronización instantánea entre pestañas del mismo equipo
 */
export class CloudSyncService {
  private roomId: string;
  private ws: WebSocket | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private statusListeners: ((status: CloudSyncStatus) => void)[] = [];
  private messageListeners: ((msg: SyncMessage) => void)[] = [];
  private reconnectTimer: any = null;
  private isDestroyed = false;
  private processedMessageIds = new Set<string>();
  public status: CloudSyncStatus = 'connecting';

  constructor(roomId?: string) {
    this.roomId = roomId || getOrCreateRoomId();
    this.initBroadcastChannel();
    this.connectWebSocket();
    // Recuperar historial de sala inmediatamente al instanciar
    this.fetchRoomHistory();
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
      // ignore
    }
  }

  /**
   * Resuelve el contenido de un mensaje de ntfy.sh, soportando payloads de más de 4KB (archivos adjuntos)
   */
  private async parseNtfyEvent(raw: any): Promise<SyncMessage | null> {
    try {
      if (raw.id && this.processedMessageIds.has(raw.id)) {
        return null;
      }
      if (raw.id) {
        this.processedMessageIds.add(raw.id);
        // Limitar tamaño del set para evitar fuga de memoria
        if (this.processedMessageIds.size > 1000) {
          const first = this.processedMessageIds.values().next().value;
          if (first) this.processedMessageIds.delete(first);
        }
      }

      if (raw.event !== 'message') return null;

      let jsonString = raw.message;

      // Si el mensaje vino como adjunto (porque supera el límite de 4KB de texto en ntfy.sh)
      if (raw.attachment && raw.attachment.url) {
        try {
          const fileRes = await fetch(raw.attachment.url);
          if (fileRes.ok) {
            jsonString = await fileRes.text();
          }
        } catch (err) {
          console.error('Error al descargar adjunto de ntfy', err);
          return null;
        }
      }

      if (!jsonString || typeof jsonString !== 'string') return null;

      const parsed: SyncMessage = JSON.parse(jsonString);
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Recupera el último estado de la sala desde el caché cloud de ntfy.sh (?poll=1)
   * Esto permite que el celular obtenga las 1.000 ubicaciones al instante al abrir la sala
   */
  public async fetchRoomHistory(): Promise<void> {
    try {
      const res = await fetch(`https://ntfy.sh/${this.roomId}/json?poll=1`);
      if (!res.ok) return;

      const text = await res.text();
      const lines = text.trim().split('\n').filter(Boolean);

      // Procesar mensajes en orden cronológico
      for (const line of lines) {
        try {
          const raw = JSON.parse(line);
          const msg = await this.parseNtfyEvent(raw);
          if (msg && msg.senderId !== CLIENT_ID) {
            this.notifyMessage(msg);
          }
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.warn('No se pudo consultar el historial inicial de la sala:', e);
    }
  }

  private connectWebSocket() {
    if (this.isDestroyed) return;
    this.updateStatus('connecting');

    try {
      const wsUrl = `wss://ntfy.sh/${this.roomId}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.updateStatus('connected');
        // Solicitar sincronización a cualquier compañero conectado
        this.sendMessage({
          type: 'REQUEST_SYNC',
          senderId: CLIENT_ID,
          roomId: this.roomId,
          timestamp: Date.now(),
        });
      };

      this.ws.onmessage = async (event) => {
        try {
          const raw = JSON.parse(event.data);
          const msg = await this.parseNtfyEvent(raw);
          if (msg && msg.senderId !== CLIENT_ID) {
            this.notifyMessage(msg);
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
   * Envía un mensaje hacia todos los dispositivos de la misma sala (PC y Celular).
   * Si supera 3.5KB (ej. 246 o 1.000 ubicaciones), se envía con cabecera Filename
   * para que ntfy.sh lo almacene como adjunto descargable con CORS abierto.
   */
  public async sendMessage(msg: SyncMessage): Promise<void> {
    const payloadStr = JSON.stringify(msg);

    // 1. Enviar por BroadcastChannel local (otras pestañas del navegador)
    try {
      this.broadcastChannel?.postMessage(msg);
    } catch {
      // ignore
    }

    // 2. Enviar por HTTPS POST hacia ntfy.sh
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Si supera 3KB, adjuntarlo como archivo para garantizar que nunca sea rechazado por tamaño
      if (payloadStr.length > 3000) {
        headers['Filename'] = 'bodega_sync.json';
      }

      await fetch(`https://ntfy.sh/${this.roomId}`, {
        method: 'POST',
        headers,
        body: payloadStr,
        keepalive: true,
      });
    } catch (err) {
      console.warn('Error al transmitir mensaje de sincronización:', err);
    }
  }

  /**
   * Celular o PC marca una ubicación -> Notifica al instante (payload muy ligero < 200 bytes)
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
   * PC carga un nuevo listado (hasta miles de datos) -> Notifica a los celulares al instante
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
    this.processedMessageIds.clear();
  }
}
