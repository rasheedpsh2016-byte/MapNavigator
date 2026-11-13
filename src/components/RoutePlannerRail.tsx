import React, {useMemo, useState} from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bike,
  Car,
  Clock,
  CornerUpLeft,
  CornerUpRight,
  Footprints,
  Loader2,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  Route as RouteIcon,
  ShieldAlert,
  Sparkles,
  TrainFront,
  Trash2,
} from 'lucide-react';
import type {
  ComputedRouteSummary,
  LocationPoint,
  PinDropMode,
  RailTab,
  RoutingPreferenceOption,
  TrafficModelOption,
  TravelModeOption,
} from '../types/navigation';
import {
  formatDelayLabel,
  formatDistance,
  formatDuration,
  formatEtaTime,
  formatManeuverName,
} from '../utils/formatters';
import {PlaceSearchInput} from './PlaceSearchInput';

interface RoutePlannerRailProps {
  activeTab: RailTab;
  onChangeTab: (tab: RailTab) => void;
  origin: LocationPoint | null;
  destination: LocationPoint | null;
  stops: LocationPoint[];
  onChangeOrigin: (pt: LocationPoint | null) => void;
  onChangeDestination: (pt: LocationPoint | null) => void;
  onSwapEndpoints: () => void;
  onAddStop: () => void;
  onUpdateStop: (idx: number, pt: LocationPoint | null) => void;
  onRemoveStop: (idx: number) => void;
  onMoveStop: (idx: number, dir: -1 | 1) => void;
  travelMode: TravelModeOption;
  onChangeTravelMode: (mode: TravelModeOption) => void;
  routingPreference: RoutingPreferenceOption;
  onChangeRoutingPreference: (pref: RoutingPreferenceOption) => void;
  trafficModel: TrafficModelOption;
  onChangeTrafficModel: (model: TrafficModelOption) => void;
  departureInput: string;
  onChangeDepartureInput: (val: string) => void;
  optimizeStopOrder: boolean;
  onToggleOptimizeStopOrder: () => void;
  avoidTolls: boolean;
  onToggleAvoidTolls: () => void;
  avoidHighways: boolean;
  onToggleAvoidHighways: () => void;
  avoidFerries: boolean;
  onToggleAvoidFerries: () => void;
  autoRefreshSeconds: number;
  onChangeAutoRefreshSeconds: (secs: number) => void;
  routes: ComputedRouteSummary[];
  selectedRouteIndex: number;
  onSelectRoute: (idx: number) => void;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  onRefreshRoutes: () => void;
  pinDropMode: PinDropMode;
  onSetPinDropMode: (mode: PinDropMode) => void;
  onUseCurrentLocation: () => void;
  isLocating: boolean;
  mapCenter: google.maps.LatLngLiteral;
  onFocusStep: (loc: google.maps.LatLngLiteral) => void;
  onQuickSearchSample: (query: string, target: 'origin' | 'destination') => void;
  isQuickSearching: boolean;
  onOpenCredits?: () => void;
}

function getManeuverIcon(maneuver: string) {
  if (maneuver.includes('LEFT')) {
    return <CornerUpLeft className="h-4 w-4 text-slate-600 dark:text-slate-300 shrink-0" />;
  }
  if (maneuver.includes('RIGHT')) {
    return <CornerUpRight className="h-4 w-4 text-slate-600 dark:text-slate-300 shrink-0" />;
  }
  return <Navigation className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />;
}

export function RoutePlannerRail({
  activeTab,
  onChangeTab,
  origin,
  destination,
  stops,
  onChangeOrigin,
  onChangeDestination,
  onSwapEndpoints,
  onAddStop,
  onUpdateStop,
  onRemoveStop,
  onMoveStop,
  travelMode,
  onChangeTravelMode,
  routingPreference,
  onChangeRoutingPreference,
  trafficModel,
  onChangeTrafficModel,
  departureInput,
  onChangeDepartureInput,
  optimizeStopOrder,
  onToggleOptimizeStopOrder,
  avoidTolls,
  onToggleAvoidTolls,
  avoidHighways,
  onToggleAvoidHighways,
  avoidFerries,
  onToggleAvoidFerries,
  autoRefreshSeconds,
  onChangeAutoRefreshSeconds,
  routes,
  selectedRouteIndex,
  onSelectRoute,
  isLoading,
  error,
  lastUpdated,
  onRefreshRoutes,
  pinDropMode,
  onSetPinDropMode,
  onUseCurrentLocation,
  isLocating,
  mapCenter,
  onFocusStep,
  onQuickSearchSample,
  isQuickSearching,
  onOpenCredits,
}: RoutePlannerRailProps) {
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(true);

  const selectedRoute = routes[selectedRouteIndex] ?? routes[0] ?? null;
  const supportsTraffic =
    travelMode === 'DRIVING' || travelMode === 'TWO_WHEELER';

  const departureDate = useMemo(() => {
    if (!departureInput) return null;
    const d = new Date(departureInput);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [departureInput]);

  const optimizedStopSequence = useMemo(() => {
    if (!selectedRoute || stops.length === 0) return [];
    const indices = selectedRoute.optimizedWaypointIndices;
    if (
      indices.length === stops.length &&
      indices.every(i => i >= 0 && i < stops.length)
    ) {
      return indices.map((origIdx, pos) => ({
        order: pos + 1,
        originalIndex: origIdx + 1,
        stop: stops[origIdx],
      }));
    }
    return stops.map((stop, idx) => ({
      order: idx + 1,
      originalIndex: idx + 1,
      stop,
    }));
  }, [selectedRoute, stops]);

  return (
    <aside className="flex flex-col h-full w-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Segmented Rail Navigation */}
      <div className="px-4 pt-3 pb-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div
          role="tablist"
          aria-label="Navigation sections"
          className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800"
        >
          {(
            [
              {id: 'plan', label: 'Route Plan'},
              {id: 'traffic', label: 'Live Traffic'},
              {id: 'directions', label: 'Turn-by-Turn'},
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live Route Summary Strip when route exists */}
      {selectedRoute && (
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 shrink-0">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
                {selectedRoute.durationText}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                · {selectedRoute.distanceText}
              </span>
            </div>
            <div className="text-xs font-medium text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap shrink-0">
              ETA {formatEtaTime(selectedRoute.durationMillis, departureDate)}
            </div>
          </div>

          <div className="mt-1 flex items-center justify-between gap-2 text-xs">
            <span
              className={`font-medium tabular-nums ${
                selectedRoute.traffic.delayMillis >= 300000
                  ? 'text-red-600 dark:text-red-400'
                  : selectedRoute.traffic.delayMillis >= 60000
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {supportsTraffic && routingPreference !== 'TRAFFIC_UNAWARE'
                ? formatDelayLabel(selectedRoute.traffic.delayMillis)
                : 'Standard routing'}
            </span>

            {lastUpdated && (
              <span className="text-slate-400 dark:text-slate-500 tabular-nums">
                Updated{' '}
                {lastUpdated.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Scrollable Tab Content */}
      <div className="flex-1 overflow-y-auto nav-scroll p-4 space-y-5">
        {activeTab === 'plan' && (
          <>
            {/* Travel Mode Segmented Bar */}
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                Travel Mode
              </div>
              <div className="grid grid-cols-5 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                {(
                  [
                    {id: 'DRIVING', label: 'Drive', icon: Car},
                    {id: 'TWO_WHEELER', label: 'Moto', icon: Bike},
                    {id: 'TRANSIT', label: 'Transit', icon: TrainFront},
                    {id: 'WALKING', label: 'Walk', icon: Footprints},
                    {id: 'BICYCLING', label: 'Bike', icon: Bike},
                  ] as const
                ).map(mode => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => onChangeTravelMode(mode.id)}
                      className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                        travelMode === mode.id
                          ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Waypoint Inputs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Origin, Stops & Destination
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onSwapEndpoints}
                    disabled={!origin && !destination}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-40 whitespace-nowrap shrink-0"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    <span>Swap</span>
                  </button>
                </div>
              </div>

              <PlaceSearchInput
                label="Origin"
                markerBadge="A"
                badgeColorClass="bg-blue-600 text-white"
                placeholder="Choose starting point or click GPS"
                value={origin}
                onSelect={onChangeOrigin}
                locationBias={mapCenter}
                onUseCurrentLocation={onUseCurrentLocation}
                isLocating={isLocating}
                onRequestPinDrop={() =>
                  onSetPinDropMode(
                    pinDropMode === 'origin' ? 'browse' : 'origin'
                  )
                }
                isPinDropActive={pinDropMode === 'origin'}
              />

              {/* Intermediate Stops */}
              {stops.map((stop, idx) => (
                <div key={stop.id} className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 min-w-0">
                      <PlaceSearchInput
                        label={`Stop ${idx + 1}`}
                        markerBadge={String(idx + 1)}
                        badgeColorClass="bg-amber-600 text-white"
                        placeholder={`Stop ${idx + 1} address or place`}
                        value={stop.label ? stop : null}
                        onSelect={pt => onUpdateStop(idx, pt)}
                        locationBias={mapCenter}
                      />
                    </div>
                    <div className="flex items-center shrink-0">
                      <button
                        type="button"
                        onClick={() => onMoveStop(idx, -1)}
                        disabled={idx === 0}
                        aria-label={`Move stop ${idx + 1} up`}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveStop(idx, 1)}
                        disabled={idx === stops.length - 1}
                        aria-label={`Move stop ${idx + 1} down`}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveStop(idx)}
                        aria-label={`Remove stop ${idx + 1}`}
                        className="p-1.5 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <PlaceSearchInput
                label="Destination"
                markerBadge="B"
                badgeColorClass="bg-emerald-600 text-white"
                placeholder="Choose destination or pick on map"
                value={destination}
                onSelect={onChangeDestination}
                locationBias={mapCenter}
                onRequestPinDrop={() =>
                  onSetPinDropMode(
                    pinDropMode === 'destination' ? 'browse' : 'destination'
                  )
                }
                isPinDropActive={pinDropMode === 'destination'}
              />

              {/* Add Stop & Map Drop Controls */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onAddStop}
                    disabled={stops.length >= 10}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Stop</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onSetPinDropMode(
                        pinDropMode === 'stop' ? 'browse' : 'stop'
                      )
                    }
                    disabled={stops.length >= 10}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      pinDropMode === 'stop'
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    <span>Drop Stop Pin</span>
                  </button>
                </div>
              </div>

              {/* Stop Order Optimization Toggle */}
              {stops.length > 0 && (
                <label className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 cursor-pointer">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                      <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
                      <span>Optimize Stop Order</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Automatically reorder intermediate stops to minimize total
                      travel time.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={optimizeStopOrder}
                    onChange={onToggleOptimizeStopOrder}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 shrink-0"
                  />
                </label>
              )}
            </div>

            {/* Quick Local Discovery when Origin or Destination is empty */}
            {(!origin || !destination) && (
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2.5">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Quick Local Routing
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Search any address above, click the crosshair icon to pick on
                  the map, or populate nearby hubs from the current map view:
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isQuickSearching}
                    onClick={() =>
                      onQuickSearchSample(
                        'downtown transit station',
                        origin ? 'destination' : 'origin'
                      )
                    }
                    className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-blue-500 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    {origin ? 'Set Dest: Transit Hub' : 'Set Origin: Transit Hub'}
                  </button>
                  <button
                    type="button"
                    disabled={isQuickSearching}
                    onClick={() =>
                      onQuickSearchSample(
                        'international airport',
                        origin ? 'destination' : 'origin'
                      )
                    }
                    className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-blue-500 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    {origin ? 'Set Dest: Airport' : 'Set Origin: Airport'}
                  </button>
                </div>
              </div>
            )}

            {/* Traffic & Route Options */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Traffic & Route Modifiers
                </span>
                <button
                  type="button"
                  onClick={() => setShowAdvancedOptions(v => !v)}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
                >
                  {showAdvancedOptions ? 'Hide' : 'Show'}
                </button>
              </div>

              {showAdvancedOptions && (
                <div className="space-y-3">
                  {supportsTraffic && (
                    <>
                      <div>
                        <label
                          htmlFor="routing-pref"
                          className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                        >
                          Traffic Calculation
                        </label>
                        <select
                          id="routing-pref"
                          value={routingPreference}
                          onChange={e =>
                            onChangeRoutingPreference(
                              e.target.value as RoutingPreferenceOption
                            )
                          }
                          className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                        >
                          <option value="TRAFFIC_AWARE_OPTIMAL">
                            Live Traffic Optimal (Highest Accuracy)
                          </option>
                          <option value="TRAFFIC_AWARE">
                            Live Traffic Fast (Low Latency)
                          </option>
                          <option value="TRAFFIC_UNAWARE">
                            Free-Flow Baseline (Ignore Traffic)
                          </option>
                        </select>
                      </div>

                      {travelMode === 'DRIVING' &&
                        routingPreference === 'TRAFFIC_AWARE_OPTIMAL' && (
                          <div>
                            <label
                              htmlFor="traffic-model"
                              className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                            >
                              Traffic Prediction Model
                            </label>
                            <select
                              id="traffic-model"
                              value={trafficModel}
                              onChange={e =>
                                onChangeTrafficModel(
                                  e.target.value as TrafficModelOption
                                )
                              }
                              className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                            >
                              <option value="bestguess">
                                Best Guess (Real-Time + Historical)
                              </option>
                              <option value="pessimistic">
                                Conservative (Buffer for Congestion)
                              </option>
                              <option value="optimistic">
                                Optimistic (Lighter Traffic Assumed)
                              </option>
                            </select>
                          </div>
                        )}
                    </>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="departure-time"
                        className="text-xs font-medium text-slate-600 dark:text-slate-300"
                      >
                        Departure Schedule
                      </label>
                      {departureInput && (
                        <button
                          type="button"
                          onClick={() => onChangeDepartureInput('')}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Reset to Leave Now
                        </button>
                      )}
                    </div>
                    <input
                      id="departure-time"
                      type="datetime-local"
                      value={departureInput}
                      onChange={e => onChangeDepartureInput(e.target.value)}
                      className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                    />
                  </div>

                  {supportsTraffic && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(
                        [
                          {
                            label: 'Avoid Tolls',
                            checked: avoidTolls,
                            toggle: onToggleAvoidTolls,
                          },
                          {
                            label: 'Avoid Highways',
                            checked: avoidHighways,
                            toggle: onToggleAvoidHighways,
                          },
                          {
                            label: 'Avoid Ferries',
                            checked: avoidFerries,
                            toggle: onToggleAvoidFerries,
                          },
                        ] as const
                      ).map(mod => (
                        <button
                          key={mod.label}
                          type="button"
                          aria-pressed={mod.checked}
                          onClick={mod.toggle}
                          className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                            mod.checked
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          {mod.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action & Status */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={onRefreshRoutes}
              disabled={!origin || !destination || isLoading}
              className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Computing Optimal Route...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span>
                    {selectedRoute
                      ? 'Recalculate with Live Traffic'
                      : 'Calculate Optimal Route'}
                  </span>
                </>
              )}
            </button>
          </>
        )}

        {activeTab === 'traffic' && (
          <div className="space-y-5">
            {!selectedRoute ? (
              <div className="py-10 text-center space-y-2">
                <RouteIcon className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600" />
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  No active route calculated
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  Select an origin and destination in Route Plan to inspect
                  real-time traffic delays, speed corridors, and alternatives.
                </p>
                <button
                  type="button"
                  onClick={() => onChangeTab('plan')}
                  className="mt-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 whitespace-nowrap shrink-0"
                >
                  Open Route Plan
                </button>
              </div>
            ) : (
              <>
                {/* Auto-Refresh Controls */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="h-4 w-4 text-slate-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                        Traffic Auto-Refresh
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Poll live ETA & congestion shifts
                      </div>
                    </div>
                  </div>
                  <select
                    aria-label="Traffic auto-refresh interval"
                    value={autoRefreshSeconds}
                    onChange={e =>
                      onChangeAutoRefreshSeconds(Number(e.target.value))
                    }
                    className="h-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-medium text-slate-900 dark:text-slate-100"
                  >
                    <option value={0}>Manual</option>
                    <option value={30}>Every 30s</option>
                    <option value={60}>Every 60s</option>
                    <option value={180}>Every 3m</option>
                  </select>
                </div>

                {/* Speed Corridor Distribution */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Corridor Speed Breakdown
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      Free-flow {selectedRoute.staticDurationText}
                    </span>
                  </div>

                  <div className="h-2.5 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex">
                    <div
                      style={{width: `${selectedRoute.traffic.normalPct}%`}}
                      className="bg-blue-600 h-full transition-all"
                      title={`Normal: ${selectedRoute.traffic.normalPct}%`}
                    />
                    <div
                      style={{width: `${selectedRoute.traffic.slowPct}%`}}
                      className="bg-amber-500 h-full transition-all"
                      title={`Slow: ${selectedRoute.traffic.slowPct}%`}
                    />
                    <div
                      style={{width: `${selectedRoute.traffic.jamPct}%`}}
                      className="bg-red-600 h-full transition-all"
                      title={`Traffic Jam: ${selectedRoute.traffic.jamPct}%`}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                    <div className="p-2 rounded-md border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <span className="h-2 w-2 rounded-sm bg-blue-600" />
                        <span>Normal</span>
                      </div>
                      <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100 tabular-nums font-mono">
                        {selectedRoute.traffic.normalPct}%
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 tabular-nums">
                        {formatDistance(selectedRoute.traffic.normalMeters)}
                      </div>
                    </div>

                    <div className="p-2 rounded-md border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <span className="h-2 w-2 rounded-sm bg-amber-500" />
                        <span>Slow</span>
                      </div>
                      <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100 tabular-nums font-mono">
                        {selectedRoute.traffic.slowPct}%
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 tabular-nums">
                        {formatDistance(selectedRoute.traffic.slowMeters)}
                      </div>
                    </div>

                    <div className="p-2 rounded-md border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <span className="h-2 w-2 rounded-sm bg-red-600" />
                        <span>Heavy Jam</span>
                      </div>
                      <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100 tabular-nums font-mono">
                        {selectedRoute.traffic.jamPct}%
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 tabular-nums">
                        {formatDistance(selectedRoute.traffic.jamMeters)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alternative Routes Comparison */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Available Routes ({routes.length})
                  </div>

                  <div className="space-y-2">
                    {routes.map((rt, idx) => {
                      const isSelected = idx === selectedRouteIndex;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => onSelectRoute(idx)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40'
                              : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                              Route {idx + 1}{' '}
                              {rt.routeLabels.length > 0 && (
                                <span className="font-normal text-slate-500 dark:text-slate-400">
                                  ·{' '}
                                  {rt.routeLabels
                                    .map(l => formatManeuverName(l))
                                    .join(', ')}
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 tabular-nums shrink-0">
                              {rt.durationText}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            <span>{rt.distanceText}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {formatDelayLabel(rt.traffic.delayMillis)}
                            </span>
                            {rt.tollText && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>Est. toll {rt.tollText}</span>
                              </>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Optimized Stop Visit Order */}
                {stops.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {optimizeStopOrder
                          ? 'Optimized Visit Sequence'
                          : 'Planned Stop Sequence'}
                      </span>
                    </div>
                    <ol className="space-y-1.5 text-xs">
                      <li className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <span className="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center font-semibold shrink-0">
                          A
                        </span>
                        <span className="truncate font-medium">
                          {origin?.label}
                        </span>
                      </li>
                      {optimizedStopSequence.map(item => (
                        <li
                          key={item.stop.id}
                          className="flex items-center justify-between gap-2 text-slate-700 dark:text-slate-300"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded bg-amber-600 text-white flex items-center justify-center font-semibold tabular-nums shrink-0">
                              {item.order}
                            </span>
                            <span className="truncate">{item.stop.label}</span>
                          </div>
                          {optimizeStopOrder &&
                            item.order !== item.originalIndex && (
                              <span className="text-slate-400 tabular-nums shrink-0">
                                was #{item.originalIndex}
                              </span>
                            )}
                        </li>
                      ))}
                      <li className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <span className="w-5 h-5 rounded bg-emerald-600 text-white flex items-center justify-center font-semibold shrink-0">
                          B
                        </span>
                        <span className="truncate font-medium">
                          {destination?.label}
                        </span>
                      </li>
                    </ol>
                  </div>
                )}

                {/* Route Advisories / Warnings */}
                {selectedRoute.warnings.length > 0 && (
                  <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                      <ShieldAlert className="h-4 w-4 shrink-0" />
                      <span>Route Advisories</span>
                    </div>
                    <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-200">
                      {selectedRoute.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'directions' && (
          <div className="space-y-4">
            {!selectedRoute ? (
              <div className="py-10 text-center space-y-2">
                <Navigation className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600" />
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Turn-by-turn directions pending
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  Enter an origin and destination to inspect step-by-step
                  maneuvers and leg durations.
                </p>
                <button
                  type="button"
                  onClick={() => onChangeTab('plan')}
                  className="mt-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 whitespace-nowrap shrink-0"
                >
                  Open Route Plan
                </button>
              </div>
            ) : (
              selectedRoute.legs.map(leg => (
                <div key={leg.legIndex} className="space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Leg {leg.legIndex + 1} of {selectedRoute.legs.length}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {leg.durationText} · {leg.distanceText}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {leg.steps.map(step => (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => {
                          if (step.startLocation) {
                            onFocusStep(step.startLocation);
                          }
                        }}
                        className="w-full text-left py-2.5 px-2 -mx-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-start gap-3 transition-colors"
                      >
                        <div className="mt-0.5">
                          {getManeuverIcon(step.maneuver)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-snug">
                            {step.instructions}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            <span>{step.distanceText}</span>
                            <span aria-hidden="true">·</span>
                            <span>{step.durationText}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {onOpenCredits && (
        <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <span>MapNavigator</span>
          <button
            type="button"
            onClick={onOpenCredits}
            className="font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
          >
            Creator & Credits
          </button>
        </div>
      )}
    </aside>
  );
}
