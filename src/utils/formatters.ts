import type {
  ComputedRouteSummary,
  RouteLegSummary,
  RouteStepSummary,
  TrafficBreakdown,
} from '../types/navigation';

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0 min';
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return '< 1 min';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '0 m';
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return km >= 100 ? `${km.toFixed(0)} km` : `${km.toFixed(1)} km`;
}

export function formatEtaTime(durationMs: number, departureDate?: Date | null): string {
  const base = departureDate ? departureDate.getTime() : Date.now();
  const arrival = new Date(base + Math.max(0, durationMs));
  return arrival.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}

export function formatDelayLabel(delayMillis: number): string {
  const delayMins = Math.round(delayMillis / 60000);
  if (delayMins <= 0) return 'Clear flow';
  if (delayMins === 1) return '+1 min delay';
  return `+${delayMins} min delay`;
}

export function haversineMeters(
  a: {lat: number; lng: number},
  b: {lat: number; lng: number}
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toLatLngLiteral(pt: unknown): google.maps.LatLngLiteral | null {
  if (!pt || typeof pt !== 'object') return null;
  const obj = pt as {
    lat?: number | (() => number);
    lng?: number | (() => number);
  };
  const lat = typeof obj.lat === 'function' ? obj.lat() : obj.lat;
  const lng = typeof obj.lng === 'function' ? obj.lng() : obj.lng;
  if (typeof lat === 'number' && typeof lng === 'number') {
    return {lat, lng};
  }
  return null;
}

export function computeTrafficBreakdown(
  route: google.maps.routes.Route
): TrafficBreakdown {
  const durationMillis = route.durationMillis ?? 0;
  const staticDurationMillis = route.staticDurationMillis ?? durationMillis;
  const delayMillis = Math.max(0, durationMillis - staticDurationMillis);

  let normalMeters = 0;
  let slowMeters = 0;
  let jamMeters = 0;

  const speedPaths = route.speedPaths ?? [];
  for (const sp of speedPaths) {
    const pts = sp.path ?? [];
    let segMeters = 0;
    for (let i = 1; i < pts.length; i++) {
      const p1 = toLatLngLiteral(pts[i - 1]);
      const p2 = toLatLngLiteral(pts[i]);
      if (p1 && p2) {
        segMeters += haversineMeters(p1, p2);
      }
    }
    const speed = String(sp.speed ?? 'NORMAL');
    if (speed === 'TRAFFIC_JAM') {
      jamMeters += segMeters;
    } else if (speed === 'SLOW') {
      slowMeters += segMeters;
    } else {
      normalMeters += segMeters;
    }
  }

  const totalSpeedMeters = normalMeters + slowMeters + jamMeters;
  const hasTrafficData = totalSpeedMeters > 0;

  if (!hasTrafficData) {
    const fallbackTotal = route.distanceMeters ?? 0;
    return {
      normalMeters: fallbackTotal,
      slowMeters: 0,
      jamMeters: 0,
      totalMeters: fallbackTotal,
      normalPct: 100,
      slowPct: 0,
      jamPct: 0,
      delayMillis,
      hasTrafficData: false,
    };
  }

  const normalPct = Math.round((normalMeters / totalSpeedMeters) * 100);
  const slowPct = Math.round((slowMeters / totalSpeedMeters) * 100);
  const jamPct = Math.max(0, 100 - normalPct - slowPct);

  return {
    normalMeters,
    slowMeters,
    jamMeters,
    totalMeters: totalSpeedMeters,
    normalPct,
    slowPct,
    jamPct,
    delayMillis,
    hasTrafficData: true,
  };
}

export function parseRouteSummary(
  route: google.maps.routes.Route,
  index: number
): ComputedRouteSummary {
  const distanceMeters = route.distanceMeters ?? 0;
  const durationMillis = route.durationMillis ?? 0;
  const staticDurationMillis = route.staticDurationMillis ?? durationMillis;

  const legs: RouteLegSummary[] = (route.legs ?? []).map((leg, legIndex) => {
    const legDist = leg.distanceMeters ?? 0;
    const legDur = leg.durationMillis ?? 0;
    const legStaticDur = leg.staticDurationMillis ?? legDur;

    const steps: RouteStepSummary[] = (leg.steps ?? []).map((step, stepIndex) => {
      const stepDist = step.distanceMeters ?? 0;
      const stepDur = step.staticDurationMillis ?? 0;
      const startLoc = toLatLngLiteral(step.startLocation);

      return {
        id: `${legIndex}-${stepIndex}`,
        legIndex,
        stepIndex,
        instructions: step.instructions || 'Continue along route',
        maneuver: step.maneuver || 'STRAIGHT',
        distanceMeters: stepDist,
        durationMillis: stepDur,
        distanceText: step.localizedValues?.distance || formatDistance(stepDist),
        durationText:
          step.localizedValues?.staticDuration || formatDuration(stepDur),
        startLocation: startLoc ?? undefined,
      };
    });

    return {
      legIndex,
      distanceMeters: legDist,
      durationMillis: legDur,
      staticDurationMillis: legStaticDur,
      distanceText: leg.localizedValues?.distance || formatDistance(legDist),
      durationText: leg.localizedValues?.duration || formatDuration(legDur),
      steps,
    };
  });

  const prices = route.travelAdvisory?.tollInfo?.estimatedPrices;
  let tollText: string | undefined;
  if (prices && prices.length > 0) {
    const p = prices[0];
    const units = Number(p.units ?? 0);
    const nanos = Number(p.nanos ?? 0) / 1e9;
    const val = (units + nanos).toFixed(2);
    tollText = `${p.currencyCode ?? 'USD'} ${val}`;
  }

  return {
    index,
    rawRoute: route,
    distanceMeters,
    durationMillis,
    staticDurationMillis,
    distanceText: route.localizedValues?.distance || formatDistance(distanceMeters),
    durationText: route.localizedValues?.duration || formatDuration(durationMillis),
    staticDurationText:
      route.localizedValues?.staticDuration || formatDuration(staticDurationMillis),
    routeLabels: (route.routeLabels ?? []).map(String),
    warnings: route.warnings ?? [],
    optimizedWaypointIndices: route.optimizedIntermediateWaypointIndices ?? [],
    traffic: computeTrafficBreakdown(route),
    legs,
    tollText,
  };
}

export function formatManeuverName(maneuver: string): string {
  return maneuver
    .toLowerCase()
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
