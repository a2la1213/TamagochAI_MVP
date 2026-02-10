// src/services/sensors/LocationService.ts
import * as Location from 'expo-location';
import { createLogger } from '../../utils/helpers';

const log = createLogger('Location');

let lastLocation: { city: string; country: string } | null = null;
let lastUpdate = 0;

/**
 * Récupère la localisation approximative (ville)
 */
export async function getApproxLocation(): Promise<string> {
  try {
    // Cache 30 min
    if (lastLocation && Date.now() - lastUpdate < 30 * 60 * 1000) {
      return `${lastLocation.city}, ${lastLocation.country}`;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return 'non disponible';

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    });

    const [geo] = await Location.reverseGeocodeAsync({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });

    if (geo) {
      lastLocation = { city: geo.city || geo.subregion || 'inconnu', country: geo.country || '' };
      lastUpdate = Date.now();
      log.info(`Location: ${lastLocation.city}, ${lastLocation.country}`);
      return `${lastLocation.city}, ${lastLocation.country}`;
    }

    return 'non disponible';
  } catch (e) {
    log.warn('Location failed:', e);
    return 'non disponible';
  }
}

export function getCachedLocation(): string {
  if (lastLocation) return `${lastLocation.city}, ${lastLocation.country}`;
  return 'non disponible';
}
