import { useCallback, useEffect, useRef, useState } from 'react';
import {
  parseMiBodyComposition,
  parseWeightScale,
  type MiScaleMeasurement,
} from './mi-scale.parser';

const BODY_COMPOSITION_SERVICE = 0x181b;
const BODY_COMPOSITION_MEASUREMENT = 0x2a9c;
const WEIGHT_SCALE_SERVICE = 0x181d;
const WEIGHT_MEASUREMENT = 0x2a9d;

export type MiScaleStatus = 'idle' | 'requesting' | 'connecting' | 'connected' | 'reading' | 'stable' | 'error';

export interface UseMiScaleOptions {
  onMeasurement?: (m: MiScaleMeasurement) => void;
  onStable?: (m: MiScaleMeasurement) => void;
}

export interface UseMiScaleResult {
  supported: boolean;
  status: MiScaleStatus;
  error: string | null;
  deviceName: string | null;
  lastMeasurement: MiScaleMeasurement | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice: (options: unknown) => Promise<BluetoothDevice>;
    };
  }
  interface BluetoothDevice {
    name?: string;
    gatt?: {
      connected: boolean;
      connect: () => Promise<BluetoothRemoteGATTServer>;
      disconnect: () => void;
    };
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
  }
  interface BluetoothRemoteGATTServer {
    getPrimaryService: (uuid: number | string) => Promise<BluetoothRemoteGATTService>;
    getPrimaryServices: () => Promise<BluetoothRemoteGATTService[]>;
    disconnect: () => void;
    connected: boolean;
  }
  interface BluetoothRemoteGATTService {
    uuid: string;
    getCharacteristic: (uuid: number | string) => Promise<BluetoothRemoteGATTCharacteristic>;
  }
  interface BluetoothRemoteGATTCharacteristic {
    startNotifications: () => Promise<BluetoothRemoteGATTCharacteristic>;
    stopNotifications: () => Promise<BluetoothRemoteGATTCharacteristic>;
    addEventListener: (type: string, listener: (e: Event) => void) => void;
    removeEventListener: (type: string, listener: (e: Event) => void) => void;
    value?: DataView;
  }
}

export function useMiScale(opts: UseMiScaleOptions = {}): UseMiScaleResult {
  const supported = typeof navigator !== 'undefined' && !!navigator.bluetooth;
  const [status, setStatus] = useState<MiScaleStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [lastMeasurement, setLastMeasurement] = useState<MiScaleMeasurement | null>(null);

  const deviceRef = useRef<BluetoothDevice | null>(null);
  const charRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const onMeasurementRef = useRef(opts.onMeasurement);
  const onStableRef = useRef(opts.onStable);
  useEffect(() => {
    onMeasurementRef.current = opts.onMeasurement;
    onStableRef.current = opts.onStable;
  }, [opts.onMeasurement, opts.onStable]);

  // Buffer de medidas recientes para detectar estabilización por heurística
  // (varias lecturas seguidas con el mismo peso ≈ usuario quieto).
  const recentRef = useRef<number[]>([]);
  // Una vez emitida una medida estable, no volvemos a disparar onStable
  // hasta que el usuario reconecte (evita oscilaciones / re-pisado).
  const stableEmittedRef = useRef(false);
  // Guardamos los callbacks de cleanup en un ref para usarlos sin
  // crear ciclos de dependencias entre handleNotification y cleanup.
  const cleanupRef = useRef<() => void>(() => {});

  const cleanup = useCallback(() => {
    if (charRef.current) {
      try {
        charRef.current.removeEventListener('characteristicvaluechanged', handleNotification);
        charRef.current.stopNotifications().catch(() => {});
      } catch {
        // ignored
      }
      charRef.current = null;
    }
    if (deviceRef.current) {
      try {
        deviceRef.current.gatt?.disconnect();
      } catch {
        // ignored
      }
      deviceRef.current = null;
    }
    recentRef.current = [];
  }, []);

  const handleDisconnect = useCallback(() => {
    setStatus((prev) => (prev === 'stable' ? prev : 'idle'));
    setDeviceName(null);
    cleanup();
  }, [cleanup]);

  const handleNotification = useCallback((event: Event) => {
    const target = event.target as unknown as BluetoothRemoteGATTCharacteristic;
    const dv = target.value;
    if (!dv) return;
    // Probamos primero el formato Mi Body Composition (más rico). Si el byteLength
    // es menor (3-5 bytes), caemos al parser estándar Weight Scale.
    const m =
      dv.byteLength >= 13
        ? parseMiBodyComposition(dv)
        : parseWeightScale(dv);
    if (!m) return;
    setLastMeasurement(m);
    onMeasurementRef.current?.(m);

    // Si ya emitimos una medida estable, ignoramos lo siguiente (la báscula
    // suele seguir enviando paquetes de "removed" o similares).
    if (stableEmittedRef.current) return;

    // No nos interesa el peso 0 / persona aún subiendo / báscula vacía.
    if (m.removed || m.kg <= 5) {
      recentRef.current = [];
      setStatus('reading');
      return;
    }

    // Heurística: 4 lecturas seguidas con diferencia < 0.1 kg = estable.
    // (la báscula manda ~10 paquetes/seg). Combinamos con el bit "stabilized"
    // del parser cuando esté disponible.
    const buf = recentRef.current;
    buf.push(m.kg);
    if (buf.length > 5) buf.shift();
    const heuristicStable =
      buf.length >= 4 && Math.max(...buf) - Math.min(...buf) < 0.1;

    if (m.stabilized || heuristicStable) {
      stableEmittedRef.current = true;
      setStatus('stable');
      onStableRef.current?.(m);
      // Paramos la báscula: ya tenemos el peso, no queremos seguir leyendo.
      cleanupRef.current();
    } else {
      setStatus('reading');
    }
  }, []);

  // Mantener cleanupRef sincronizado para que handleNotification pueda llamarlo
  // sin crear un ciclo de dependencias.
  useEffect(() => {
    cleanupRef.current = cleanup;
  }, [cleanup]);

  const connect = useCallback(async () => {
    if (!supported) {
      setError('Bluetooth not supported');
      setStatus('error');
      return;
    }
    setError(null);
    setStatus('requesting');
    stableEmittedRef.current = false;
    recentRef.current = [];
    setLastMeasurement(null);
    try {
      const device = await navigator.bluetooth!.requestDevice({
        filters: [
          { namePrefix: 'MI' },
          { namePrefix: 'MI_SCALE' },
          { namePrefix: 'Mi Scale' },
          { services: [BODY_COMPOSITION_SERVICE] },
          { services: [WEIGHT_SCALE_SERVICE] },
        ],
        optionalServices: [BODY_COMPOSITION_SERVICE, WEIGHT_SCALE_SERVICE],
      });
      deviceRef.current = device;
      setDeviceName(device.name ?? 'Mi Scale');
      device.addEventListener('gattserverdisconnected', handleDisconnect);

      setStatus('connecting');
      const server = await device.gatt!.connect();

      // Intentamos primero Body Composition (Mi Scale 2). Si no, caemos a Weight Scale.
      let characteristic: BluetoothRemoteGATTCharacteristic | null = null;
      try {
        const svc = await server.getPrimaryService(BODY_COMPOSITION_SERVICE);
        characteristic = await svc.getCharacteristic(BODY_COMPOSITION_MEASUREMENT);
      } catch {
        const svc = await server.getPrimaryService(WEIGHT_SCALE_SERVICE);
        characteristic = await svc.getCharacteristic(WEIGHT_MEASUREMENT);
      }

      charRef.current = characteristic;
      characteristic.addEventListener('characteristicvaluechanged', handleNotification);
      await characteristic.startNotifications();
      setStatus('reading');
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Failed to connect to scale';
      // Cancelaciones del usuario no son errores reales.
      if (/cancel/i.test(msg) || /user/i.test(msg)) {
        setStatus('idle');
        setError(null);
      } else {
        setError(msg);
        setStatus('error');
      }
      cleanup();
    }
  }, [supported, handleDisconnect, handleNotification, cleanup]);

  const disconnect = useCallback(() => {
    cleanup();
    setStatus('idle');
    setDeviceName(null);
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  return { supported, status, error, deviceName, lastMeasurement, connect, disconnect };
}
