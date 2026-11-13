export type TravelModeOption =
  | 'DRIVING'
  | 'TWO_WHEELER'
  | 'TRANSIT'
  | 'WALKING'
  | 'BICYCLING';

export type RoutingPreferenceOption =
  | 'TRAFFIC_AWARE_OPTIMAL'
  | 'TRAFFIC_AWARE'
  | 'TRAFFIC_UNAWARE';

export type TrafficModelOption = 'bestguess' | 'pessimistic' | 'optimistic';

export type MapTypeOption = 'roadmap' | 'satellite' | 'hybrid' | 'terrain';

export type PinDropMode = 'browse' | 'origin' | 'stop' | 'destination';

export type RailTab = 'plan' | 'traffic' | 'directions';

export interface LocationPoint {
  id: string;
  label: string;
  address: string;
  location: google.maps.LatLngLiteral;
  placeId?: string;
}

export interface TrafficBreakdown {
  normalMeters: number;
  slowMeters: number;
  jamMeters: number;
  totalMeters: number;
  normalPct: number;
  slowPct: number;
  jamPct: number;
  delayMillis: number;
  hasTrafficData: boolean;
}

export interface RouteStepSummary {
  id: string;
  legIndex: number;
  stepIndex: number;
  instructions: string;
  maneuver: string;
  distanceMeters: number;
  durationMillis: number;
  distanceText: string;
  durationText: string;
  startLocation?: google.maps.LatLngLiteral;
}

export interface RouteLegSummary {
  legIndex: number;
  distanceMeters: number;
  durationMillis: number;
  staticDurationMillis: number;
  distanceText: string;
  durationText: string;
  steps: RouteStepSummary[];
}

export interface ComputedRouteSummary {
  index: number;
  rawRoute: google.maps.routes.Route;
  distanceMeters: number;
  durationMillis: number;
  staticDurationMillis: number;
  distanceText: string;
  durationText: string;
  staticDurationText: string;
  routeLabels: string[];
  warnings: string[];
  optimizedWaypointIndices: number[];
  traffic: TrafficBreakdown;
  legs: RouteLegSummary[];
  tollText?: string;
}
