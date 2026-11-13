import {useCallback, useEffect, useRef, useState} from 'react';
import {useMapsLibrary} from '@vis.gl/react-google-maps';
import type {
  ComputedRouteSummary,
  LocationPoint,
  RoutingPreferenceOption,
  TrafficModelOption,
  TravelModeOption,
} from '../types/navigation';
import {parseRouteSummary} from '../utils/formatters';
import {notifyQuotaExceededIfApplicable} from '../utils/quota';

export interface RoutePlannerConfig {
  origin: LocationPoint | null;
  destination: LocationPoint | null;
  stops: LocationPoint[];
  travelMode: TravelModeOption;
  routingPreference: RoutingPreferenceOption;
  trafficModel: TrafficModelOption;
  departureTime: Date | null;
  optimizeStopOrder: boolean;
  avoidTolls: boolean;
  avoidHighways: boolean;
  avoidFerries: boolean;
  autoRefreshSeconds: number;
}

export interface UseRoutePlannerReturn {
  routes: ComputedRouteSummary[];
  selectedRouteIndex: number;
  setSelectedRouteIndex: (idx: number) => void;
  selectedRoute: ComputedRouteSummary | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  computeRoutes: () => Promise<void>;
  clearRoutes: () => void;
}

export function useRoutePlanner(
  config: RoutePlannerConfig
): UseRoutePlannerReturn {
  const routesLib = useMapsLibrary('routes');

  const [routes, setRoutes] = useState<ComputedRouteSummary[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const requestCounterRef = useRef(0);

  const {
    origin,
    destination,
    stops,
    travelMode,
    routingPreference,
    trafficModel,
    departureTime,
    optimizeStopOrder,
    avoidTolls,
    avoidHighways,
    avoidFerries,
    autoRefreshSeconds,
  } = config;

  const computeRoutes = useCallback(async () => {
    if (!routesLib || !origin || !destination) {
      return;
    }

    const reqId = ++requestCounterRef.current;
    setIsLoading(true);
    setError(null);

    const supportsTraffic =
      travelMode === 'DRIVING' || travelMode === 'TWO_WHEELER';
    const isTrafficAware =
      supportsTraffic && routingPreference !== 'TRAFFIC_UNAWARE';
    const hasStops = stops.length > 0;
    const shouldOptimizeOrder = hasStops && optimizeStopOrder;

    const fields = [
      'path',
      'distanceMeters',
      'durationMillis',
      'staticDurationMillis',
      'viewport',
      'legs',
      'localizedValues',
      'routeLabels',
      'warnings',
      'travelAdvisory',
    ];

    if (isTrafficAware) {
      fields.push('speedPaths');
    }

    if (shouldOptimizeOrder) {
      fields.push('optimizedIntermediateWaypointIndices');
    }

    const effectiveDeparture =
      departureTime && departureTime.getTime() > Date.now()
        ? departureTime
        : undefined;

    const request: google.maps.routes.ComputeRoutesRequest = {
      origin: origin.location,
      destination: destination.location,
      travelMode,
      fields,
      ...(hasStops
        ? {
            intermediates: stops.map(stop => ({
              location: stop.location,
              ...(supportsTraffic ? {vehicleStopover: true} : {}),
            })),
            optimizeWaypointOrder: shouldOptimizeOrder,
          }
        : {
            computeAlternativeRoutes: true,
          }),
      ...(supportsTraffic
        ? {
            routingPreference,
            routeModifiers: {
              avoidTolls,
              avoidHighways,
              avoidFerries,
            },
            ...(routingPreference === 'TRAFFIC_AWARE_OPTIMAL' &&
            travelMode === 'DRIVING'
              ? {trafficModel}
              : {}),
            ...(isTrafficAware
              ? {extraComputations: ['TRAFFIC_ON_POLYLINE']}
              : {}),
          }
        : {}),
      ...(effectiveDeparture ? {departureTime: effectiveDeparture} : {}),
    };

    try {
      const response = await routesLib.Route.computeRoutes(request);
      if (reqId !== requestCounterRef.current) return;

      const rawRoutes = response?.routes ?? [];
      if (rawRoutes.length === 0) {
        setRoutes([]);
        setSelectedRouteIndex(0);
        setError(
          'No navigable route found for the selected locations and options.'
        );
      } else {
        const parsed = rawRoutes.map((r, idx) => parseRouteSummary(r, idx));
        setRoutes(parsed);
        setSelectedRouteIndex(0);
        setLastUpdated(new Date());
      }
    } catch (err) {
      if (reqId !== requestCounterRef.current) return;
      notifyQuotaExceededIfApplicable(err);
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to calculate route. Check locations or route modifiers.';
      setError(message);
      setRoutes([]);
    } finally {
      if (reqId === requestCounterRef.current) {
        setIsLoading(false);
      }
    }
  }, [
    routesLib,
    origin,
    destination,
    stops,
    travelMode,
    routingPreference,
    trafficModel,
    departureTime,
    optimizeStopOrder,
    avoidTolls,
    avoidHighways,
    avoidFerries,
  ]);

  // Automatically recompute when core endpoints or options change
  useEffect(() => {
    if (!routesLib || !origin || !destination) {
      setRoutes([]);
      setError(null);
      return;
    }
    void computeRoutes();
  }, [routesLib, origin, destination, computeRoutes]);

  // Real-time traffic auto-refresh interval
  useEffect(() => {
    if (!autoRefreshSeconds || !origin || !destination || !routesLib) return;
    const id = window.setInterval(() => {
      void computeRoutes();
    }, autoRefreshSeconds * 1000);
    return () => window.clearInterval(id);
  }, [autoRefreshSeconds, origin, destination, routesLib, computeRoutes]);

  const clearRoutes = useCallback(() => {
    requestCounterRef.current++;
    setRoutes([]);
    setSelectedRouteIndex(0);
    setError(null);
    setLastUpdated(null);
  }, []);

  const selectedRoute =
    routes[selectedRouteIndex] ?? routes[0] ?? null;

  return {
    routes,
    selectedRouteIndex,
    setSelectedRouteIndex,
    selectedRoute,
    isLoading,
    error,
    lastUpdated,
    computeRoutes,
    clearRoutes,
  };
}
