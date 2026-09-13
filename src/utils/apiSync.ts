import { LocationItem, LocationStatus } from '../types';

export type SyncStatus = 'connected' | 'syncing' | 'offline' | 'error';

/**
 * Fetch current locations from server
 */
export async function fetchServerLocations(): Promise<LocationItem[] | null> {
  try {
    const res = await fetch('/api/locations');
    if (!res.ok) throw new Error('Error de conexión');
    const data = await res.json();
    return data.locations || [];
  } catch (err) {
    console.warn('No se pudo conectar con el servidor:', err);
    return null;
  }
}

/**
 * Replace all locations on the server (e.g. from PC when uploading Excel)
 */
export async function pushAllLocationsToServer(locations: LocationItem[]): Promise<boolean> {
  try {
    const res = await fetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Error al sincronizar listado completo:', err);
    return false;
  }
}

/**
 * Update single location status (Vacía / Llena) from mobile or PC
 */
export async function patchLocationStatusOnServer(id: string, status: LocationStatus): Promise<boolean> {
  try {
    const res = await fetch(`/api/locations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        countedAt: status !== 'pendiente' ? new Date().toISOString() : undefined,
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Error al actualizar estado en servidor:', err);
    return false;
  }
}

/**
 * Update location details (Nivel, Columna, Estantería, Posición)
 */
export async function putLocationOnServer(
  id: string, 
  data: { code: string; nivel: string; columna: string; estanteria: string; posicion: string }
): Promise<boolean> {
  try {
    const res = await fetch(`/api/locations/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (err) {
    console.warn('Error al guardar edición en servidor:', err);
    return false;
  }
}

/**
 * Delete a single location on server
 */
export async function deleteLocationOnServer(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/locations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.warn('Error al eliminar en servidor:', err);
    return false;
  }
}

/**
 * Delete multiple or all locations on server
 */
export async function deleteBulkLocationsOnServer(ids?: string[]): Promise<boolean> {
  try {
    const res = await fetch('/api/locations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Error al eliminar lote en servidor:', err);
    return false;
  }
}

/**
 * Subscribe to real-time events via Server-Sent Events (SSE)
 */
export function subscribeToLiveUpdates(
  onUpdate: (payload: { type: string; locations?: LocationItem[]; updatedItem?: LocationItem; deletedId?: string }) => void,
  onStatusChange: (status: SyncStatus) => void
): () => void {
  let eventSource: EventSource | null = null;
  let retryTimeout: any = null;
  let isClosed = false;

  function connect() {
    if (isClosed) return;
    try {
      onStatusChange('syncing');
      eventSource = new EventSource('/api/events');

      eventSource.onopen = () => {
        onStatusChange('connected');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onUpdate(data);
          onStatusChange('connected');
        } catch (err) {
          console.error('Error parseando SSE:', err);
        }
      };

      eventSource.onerror = () => {
        onStatusChange('offline');
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!isClosed) {
          retryTimeout = setTimeout(connect, 3000);
        }
      };
    } catch {
      onStatusChange('offline');
      if (!isClosed) {
        retryTimeout = setTimeout(connect, 4000);
      }
    }
  }

  connect();

  return () => {
    isClosed = true;
    if (retryTimeout) clearTimeout(retryTimeout);
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}
