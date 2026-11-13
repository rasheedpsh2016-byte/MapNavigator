import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  MapMouseEvent,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Crosshair,
  Layers,
  Maximize2,
  Moon,
  Sun,
  TrainFront,
  Activity,
} from 'lucide-react';
import type {
  ComputedRouteSummary,
  LocationPoint,
  MapTypeOption,
  PinDropMode,
} from '../types/navigation';
import {notifyQuotaExceededIfApplicable} from '../utils/quota';

interface MapViewportProps {
  center: google.maps.LatLngLiteral;
  zoom: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  mapType: MapTypeOption;
  onChangeMapType: (type: MapTypeOption) => void;
  showTrafficLayer: boolean;
  onToggleTrafficLayer: () => void;
  showTransitLayer: boolean;
  onToggleTransitLayer: () => void;
  origin: LocationPoint | null;
  destination: LocationPoint | null;
  stops: LocationPoint[];
  routes: ComputedRouteSummary[];
  selectedRouteIndex: number;
  onSelectRoute: (index: number) => void;
  pinDropMode: PinDropMode;
  onPinDropComplete: (point: LocationPoint, mode: PinDropMode) => void;
  onCancelPinDrop: () => void;
  userLocation: google.maps.LatLngLiteral | null;
  focusLocation: google.maps.LatLngLiteral | null;
  onCameraCenterChange: (center: google.maps.LatLngLiteral) => void;
}

interface ActiveMarkerInfo {
  id: string;
  title: string;
  subtitle: string;
  position: google.maps.LatLngLiteral;
  role: string;
}

const DEFAULT_CENTER = {lat: 37.7749, lng: -122.4194};

export function MapViewport({
  center,
  zoom,
  theme,
  onToggleTheme,
  mapType,
  onChangeMapType,
  showTrafficLayer,
  onToggleTrafficLayer,
  showTransitLayer,
  onToggleTransitLayer,
  origin,
  destination,
  stops,
  routes,
  selectedRouteIndex,
  onSelectRoute,
  pinDropMode,
  onPinDropComplete,
  onCancelPinDrop,
  userLocation,
  focusLocation,
  onCameraCenterChange,
}: MapViewportProps) {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const placesLib = useMapsLibrary('places');

  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const transitLayerRef = useRef<google.maps.TransitLayer | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  const [activeMarker, setActiveMarker] = useState<ActiveMarkerInfo | null>(
    null
  );
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);

  // Manage TrafficLayer lifecycle
  useEffect(() => {
    if (!map || !mapsLib) return;
    if (!trafficLayerRef.current) {
      trafficLayerRef.current = new mapsLib.TrafficLayer();
    }
    trafficLayerRef.current.setMap(showTrafficLayer ? map : null);
    return () => {
      trafficLayerRef.current?.setMap(null);
    };
  }, [map, mapsLib, showTrafficLayer]);

  // Manage TransitLayer lifecycle
  useEffect(() => {
    if (!map || !mapsLib) return;
    if (!transitLayerRef.current) {
      transitLayerRef.current = new mapsLib.TransitLayer();
    }
    transitLayerRef.current.setMap(showTransitLayer ? map : null);
    return () => {
      transitLayerRef.current?.setMap(null);
    };
  }, [map, mapsLib, showTransitLayer]);

  // Render route polylines (alternatives + traffic-colored primary route)
  useEffect(() => {
    if (!map) return;

    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    if (routes.length === 0) return;

    const created: google.maps.Polyline[] = [];

    // 1. Render unselected alternative routes underneath
    routes.forEach((summary, idx) => {
      if (idx === selectedRouteIndex) return;
      const altPolys = summary.rawRoute.createPolylines({
        polylineOptions: {
          strokeColor: theme === 'dark' ? '#64748B' : '#94A3B8',
          strokeOpacity: 0.72,
          strokeWeight: 5,
          zIndex: 10 + idx,
          clickable: true,
        },
      });
      altPolys.forEach(poly => {
        poly.addListener('click', () => onSelectRoute(idx));
        poly.setMap(map);
        created.push(poly);
      });
    });

    // 2. Render active selected route with outer casing + traffic speed segments
    const activeSummary = routes[selectedRouteIndex] ?? routes[0];
    if (activeSummary) {
      // Crisp outer casing for contrast over any basemap
      if (activeSummary.rawRoute.path && activeSummary.rawRoute.path.length > 0) {
        const casing = new google.maps.Polyline({
          path: activeSummary.rawRoute.path,
          strokeColor: theme === 'dark' ? '#0F172A' : '#FFFFFF',
          strokeOpacity: 0.9,
          strokeWeight: 10,
          zIndex: 25,
          clickable: false,
        });
        casing.setMap(map);
        created.push(casing);
      }

      const activePolys = activeSummary.rawRoute.createPolylines({
        polylineOptions: (_opts, details) => {
          let strokeColor = '#2563EB';
          if (details.speed === 'TRAFFIC_JAM') {
            strokeColor = '#DC2626';
          } else if (details.speed === 'SLOW') {
            strokeColor = '#D97706';
          } else if (details.speed === 'NORMAL') {
            strokeColor = '#2563EB';
          }
          return {
            strokeColor,
            strokeOpacity: 0.96,
            strokeWeight: 6,
            zIndex: 30,
          };
        },
      });

      activePolys.forEach(poly => {
        poly.setMap(map);
        created.push(poly);
      });

      if (activeSummary.rawRoute.viewport) {
        map.fitBounds(activeSummary.rawRoute.viewport, {
          top: 56,
          right: 56,
          bottom: 56,
          left: 56,
        });
      }
    }

    polylinesRef.current = created;

    return () => {
      created.forEach(p => p.setMap(null));
    };
  }, [map, routes, selectedRouteIndex, theme, onSelectRoute]);

  // Pan to step maneuver when user clicks a turn-by-turn instruction
  useEffect(() => {
    if (!map || !focusLocation) return;
    map.panTo(focusLocation);
    const currentZoom = map.getZoom() ?? 12;
    if (currentZoom < 15) {
      map.setZoom(15);
    }
  }, [map, focusLocation]);

  // Pan to explicit camera center changes (e.g. "Locate Me" button)
  useEffect(() => {
    if (!map) return;
    map.panTo(center);
  }, [map, center]);

  // Ordered stops according to TSP optimization if active
  const orderedStops = useMemo(() => {
    const activeRoute = routes[selectedRouteIndex] ?? routes[0];
    const indices = activeRoute?.optimizedWaypointIndices ?? [];
    if (
      indices.length === stops.length &&
      stops.length > 0 &&
      indices.every(i => i >= 0 && i < stops.length)
    ) {
      return indices.map((origIdx, orderPos) => ({
        stop: stops[origIdx],
        displayNumber: orderPos + 1,
      }));
    }
    return stops.map((stop, idx) => ({
      stop,
      displayNumber: idx + 1,
    }));
  }, [stops, routes, selectedRouteIndex]);

  const handleMapClick = useCallback(
    async (e: MapMouseEvent) => {
      if (pinDropMode === 'browse' || !e.detail.latLng) return;

      const lat = e.detail.latLng.lat;
      const lng = e.detail.latLng.lng;
      const coordLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      let label = `Dropped Pin (${coordLabel})`;
      let address = `Coordinates ${coordLabel}`;
      let placeId: string | undefined;

      // Attempt modern Places API (New) nearby lookup to name the clicked road/place
      if (placesLib?.Place?.searchNearby) {
        try {
          const {places} = await placesLib.Place.searchNearby({
            fields: ['displayName', 'formattedAddress', 'id'],
            locationRestriction: {
              center: {lat, lng},
              radius: 65,
            },
            maxResultCount: 1,
          });
          if (places && places.length > 0) {
            const nearest = places[0];
            if (nearest.displayName) {
              label = nearest.displayName;
            }
            if (nearest.formattedAddress) {
              address = nearest.formattedAddress;
            }
            placeId = nearest.id;
          }
        } catch (err) {
          notifyQuotaExceededIfApplicable(err);
        }
      }

      onPinDropComplete(
        {
          id: `pin-${Date.now()}`,
          label,
          address,
          location: {lat, lng},
          placeId,
        },
        pinDropMode
      );
    },
    [pinDropMode, placesLib, onPinDropComplete]
  );

  const handleFitRoute = useCallback(() => {
    if (!map) return;
    const activeRoute = routes[selectedRouteIndex] ?? routes[0];
    if (activeRoute?.rawRoute.viewport) {
      map.fitBounds(activeRoute.rawRoute.viewport, {
        top: 56,
        right: 56,
        bottom: 56,
        left: 56,
      });
      return;
    }

    const pts = [
      origin?.location,
      ...stops.map(s => s.location),
      destination?.location,
    ].filter((p): p is google.maps.LatLngLiteral => Boolean(p));

    if (pts.length >= 2) {
      const bounds = new google.maps.LatLngBounds();
      pts.forEach(p => bounds.extend(p));
      map.fitBounds(bounds, 64);
    } else if (pts.length === 1) {
      map.panTo(pts[0]);
      map.setZoom(14);
    }
  }, [map, routes, selectedRouteIndex, origin, stops, destination]);

  const activeRoute = routes[selectedRouteIndex] ?? routes[0];
  const hasTrafficOverlay =
    showTrafficLayer || Boolean(activeRoute?.traffic.hasTrafficData);

  return (
    <div className="relative w-full h-full bg-slate-100 dark:bg-slate-950">
      <GoogleMap
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={zoom}
        mapId="DEMO_MAP_ID"
        mapTypeId={mapType}
        colorScheme={theme === 'dark' ? 'DARK' : 'LIGHT'}
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapTypeControl={false}
        streetViewControl={true}
        fullscreenControl={false}
        onClick={handleMapClick}
        onIdle={ev => {
          const c = ev.map.getCenter();
          if (c) {
            onCameraCenterChange({lat: c.lat(), lng: c.lng()});
          }
        }}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{width: '100%', height: '100%'}}
      >
        {origin && (
          <AdvancedMarker
            position={origin.location}
            zIndex={50}
            onClick={() =>
              setActiveMarker({
                id: 'origin',
                title: origin.label,
                subtitle: origin.address,
                position: origin.location,
                role: 'Origin (Start)',
              })
            }
          >
            <Pin
              background="#2563EB"
              borderColor="#1E40AF"
              glyphColor="#FFFFFF"
              glyphText="A"
            />
          </AdvancedMarker>
        )}

        {orderedStops.map(({stop, displayNumber}) => (
          <AdvancedMarker
            key={stop.id}
            position={stop.location}
            zIndex={45}
            onClick={() =>
              setActiveMarker({
                id: stop.id,
                title: stop.label,
                subtitle: stop.address,
                position: stop.location,
                role: `Stop ${displayNumber}`,
              })
            }
          >
            <Pin
              background="#D97706"
              borderColor="#92400E"
              glyphColor="#FFFFFF"
              glyphText={String(displayNumber)}
            />
          </AdvancedMarker>
        ))}

        {destination && (
          <AdvancedMarker
            position={destination.location}
            zIndex={50}
            onClick={() =>
              setActiveMarker({
                id: 'destination',
                title: destination.label,
                subtitle: destination.address,
                position: destination.location,
                role: 'Destination (Finish)',
              })
            }
          >
            <Pin
              background="#16A34A"
              borderColor="#166534"
              glyphColor="#FFFFFF"
              glyphText="B"
            />
          </AdvancedMarker>
        )}

        {userLocation && (
          <AdvancedMarker position={userLocation} zIndex={60}>
            <div
              title="Your current location"
              className="h-4 w-4 rounded-full bg-blue-600 border-2 border-white shadow-md"
            />
          </AdvancedMarker>
        )}

        {activeMarker && (
          <InfoWindow
            position={activeMarker.position}
            onCloseClick={() => setActiveMarker(null)}
          >
            <div className="min-w-[180px] max-w-[260px] p-1 text-slate-900">
              <div className="text-xs font-medium text-slate-500">
                {activeMarker.role}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">
                {activeMarker.title}
              </div>
              <div className="mt-0.5 text-xs text-slate-600">
                {activeMarker.subtitle}
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Active Pin-Drop Banner */}
      {pinDropMode !== 'browse' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-2.5 shadow-md">
          <Crosshair className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
            Click anywhere on the map to set{' '}
            {pinDropMode === 'origin'
              ? 'Origin'
              : pinDropMode === 'destination'
                ? 'Destination'
                : 'Intermediate Stop'}
          </span>
          <button
            type="button"
            onClick={onCancelPinDrop}
            className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Floating Map Layer & Theme Controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur p-1 shadow-sm">
          <button
            type="button"
            onClick={onToggleTrafficLayer}
            aria-pressed={showTrafficLayer}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              showTrafficLayer
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Live Traffic</span>
          </button>

          <button
            type="button"
            onClick={onToggleTransitLayer}
            aria-pressed={showTransitLayer}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              showTransitLayer
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <TrainFront className="h-3.5 w-3.5" />
            <span>Transit</span>
          </button>

          <button
            type="button"
            onClick={() => setLayerMenuOpen(o => !o)}
            aria-expanded={layerMenuOpen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Map Type</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            title={
              theme === 'dark' ? 'Switch to light map' : 'Switch to dark map'
            }
            aria-label={
              theme === 'dark' ? 'Switch to light map' : 'Switch to dark map'
            }
            className="p-1.5 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          {(origin || destination) && (
            <button
              type="button"
              onClick={handleFitRoute}
              title="Fit route to viewport"
              aria-label="Fit route to viewport"
              className="p-1.5 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {layerMenuOpen && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-md flex items-center gap-1">
            {(
              [
                {id: 'roadmap', label: 'Roadmap'},
                {id: 'satellite', label: 'Satellite'},
                {id: 'hybrid', label: 'Hybrid'},
                {id: 'terrain', label: 'Terrain'},
              ] as const
            ).map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChangeMapType(item.id);
                  setLayerMenuOpen(false);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  mapType === item.id
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Live Traffic Speed Legend */}
      {hasTrafficOverlay && (
        <div className="absolute bottom-6 left-4 z-20 hidden sm:flex items-center gap-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-3.5 py-2 shadow-sm text-xs text-slate-700 dark:text-slate-300">
          <span className="font-medium text-slate-900 dark:text-slate-100">
            Traffic Flow
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm bg-emerald-600 inline-block" />
            <span>Fast</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm bg-blue-600 inline-block" />
            <span>Normal</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm bg-amber-600 inline-block" />
            <span>Slow</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm bg-red-600 inline-block" />
            <span>Heavy Jam</span>
          </span>
        </div>
      )}
    </div>
  );
}
