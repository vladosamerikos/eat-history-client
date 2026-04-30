/**
 * Parser para Xiaomi Mi Body Composition Scale (1 y 2).
 *
 * Referencia: https://github.com/limhenry/web-bluetooth-mi-scale
 *  y https://github.com/lolwagner/miscale-decoder
 *
 * El característico 0x2A9C (Body Composition Measurement) del servicio
 * 0x181B emite paquetes de 13 bytes en little-endian con la siguiente
 * estructura aproximada:
 *
 *   byte 0   ctrlByte0 (unit / load flags)
 *   byte 1   ctrlByte1 (stabilized bit5, impedance bit1, removed bit7)
 *   bytes 2-3   year
 *   byte 4   month
 *   byte 5   day
 *   bytes 6,7,8   hour / min / sec
 *   bytes 9-10   impedance (Ω) LE
 *   bytes 11-12  weight raw LE   (raw / 200 = kg)
 */

export interface MiScaleMeasurement {
  kg: number;
  stabilized: boolean;
  hasImpedance: boolean;
  removed: boolean;
  impedance?: number;
  /** Fecha embebida por la báscula (no siempre fiable). */
  scaleTime?: Date;
}

export function parseMiBodyComposition(value: DataView): MiScaleMeasurement | null {
  if (value.byteLength < 13) return null;
  const ctrlByte1 = value.getUint8(1);
  const stabilized = (ctrlByte1 & 0x20) !== 0;
  const hasImpedance = (ctrlByte1 & 0x02) !== 0;
  const removed = (ctrlByte1 & 0x80) !== 0;

  const rawWeight = value.getUint16(11, true);
  const kg = Math.round((rawWeight / 200) * 100) / 100;
  const impedance = hasImpedance ? value.getUint16(9, true) : undefined;

  let scaleTime: Date | undefined;
  try {
    const year = value.getUint16(2, true);
    const month = value.getUint8(4);
    const day = value.getUint8(5);
    const h = value.getUint8(6);
    const mi = value.getUint8(7);
    const s = value.getUint8(8);
    if (year > 2000 && year < 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      scaleTime = new Date(year, month - 1, day, h, mi, s);
    }
  } catch {
    // ignored
  }

  return { kg, stabilized, hasImpedance, removed, impedance, scaleTime };
}

/**
 * Parser para básculas BLE estándar (servicio 0x181D / char 0x2A9D — Weight Scale).
 * Layout: byte 0 = flags, bytes 1-2 = peso raw LE.
 *  - bit0 de flags: 0 = SI (resolución 0.005 kg, dividir entre 200)
 *                   1 = imperial (lbs, dividir entre 100)
 */
export function parseWeightScale(value: DataView): MiScaleMeasurement | null {
  if (value.byteLength < 3) return null;
  const flags = value.getUint8(0);
  const isImperial = (flags & 0x01) !== 0;
  const raw = value.getUint16(1, true);
  const kg = isImperial
    ? Math.round((raw / 100) * 0.45359237 * 100) / 100
    : Math.round((raw / 200) * 100) / 100;
  return { kg, stabilized: true, hasImpedance: false, removed: false };
}
