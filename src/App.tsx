import {useCallback, useEffect, useMemo, useState} from 'react';
import {APIProvider, useMapsLibrary} from '@vis.gl/react-google-maps';
import {
  Compass,
  Loader2,
  Map as MapIcon,
  Navigation,
  SlidersHorizontal,
} from 'lucide-react';
import {CreditsPage} from './components/CreditsPage';
import {MapViewport} from './components/MapViewport';
import {RoutePlannerRail} from './components/RoutePlannerRail';
import {useRoutePlanner} from './hooks/useRoutePlanner';
import type {
  LocationPoint,
  MapTypeOption,
  PinDropMode,
  RailTab,
  RoutingPreferenceOption,
  TrafficModelOption,
  TravelModeOption,
} from './types/navigation';
import {notifyQuotaExceededIfApplicable} from './utils/quota';

const MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  '';

const INITIAL_CENTER: google.maps.LatLngLiteral = {
  lat: 37.7749,
  lng: -122.4194,
};

function MapNavigatorWorkspace({
  theme,
  onToggleTheme,
}: {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}) {
  const placesLib = useMapsLibrary('places');

  // Navigation & UI state
  const [activePage, setActivePage] = useState<'workspace' | 'credits'>('workspace');
  const [activeTab, setActiveTab] = useState<RailTab>('plan');
  const [mobileView, setMobileView] = useState<'planner' | 'map'>('planner');
  const [mapType, setMapType] = useState<MapTypeOption>('roadmap');
  const [showTrafficLayer, setShowTrafficLayer] = useState(true);
  const [showTransitLayer, setShowTransitLayer] = useState(false);

  // Camera & Geolocation state
  const [cameraTarget, setCameraTarget] =
    useState<google.maps.LatLngLiteral>(INITIAL_CENTER);
  const [liveMapCenter, setLiveMapCenter] =
    useState<google.maps.LatLngLiteral>(INITIAL_CENTER);
  const [userLocation, setUserLocation] =
    useState<google.maps.LatLngLiteral | null>(null);
  const [focusLocation, setFocusLocation] =
    useState<google.maps.LatLngLiteral | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Route & Waypoint state
  const [origin, setOrigin] = useState<LocationPoint | null>(null);
  const [destination, setDestination] = useState<LocationPoint | null>(null);
  const [stops, setStops] = useState<LocationPoint[]>([]);
  const [pinDropMode, setPinDropMode] = useState<PinDropMode>('browse');
  const [isQuickSearching, setIsQuickSearching] = useState(false);

  // Routing & Traffic options
  const [travelMode, setTravelMode] = useState<TravelModeOption>('DRIVING');
  const [routingPreference, setRoutingPreference] =
    useState<RoutingPreferenceOption>('TRAFFIC_AWARE_OPTIMAL');
  const [trafficModel, setTrafficModel] =
    useState<TrafficModelOption>('bestguess');
  const [departureInput, setDepartureInput] = useState('');
  const [optimizeStopOrder, setOptimizeStopOrder] = useState(true);
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidHighways, setAvoidHighways] = useState(false);
  const [avoidFerries, setAvoidFerries] = useState(false);
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(0);

  const departureTime = useMemo(() => {
    if (!departureInput) return null;
    const parsed = new Date(departureInput);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [departureInput]);

  // Filter out placeholder empty stops before computing routes
  const activeStops = useMemo(
    () => stops.filter(s => Boolean(s.label && s.location)),
    [stops]
  );

  const {
    routes,
    selectedRouteIndex,
    setSelectedRouteIndex,
    isLoading,
    error: routeError,
    lastUpdated,
    computeRoutes,
  } = useRoutePlanner({
    origin,
    destination,
    stops: activeStops,
    travelMode,
    routingPreference,
    trafficModel,
    departureTime,
    optimizeStopOrder,
    avoidTolls,
    avoidHighways,
    avoidFerries,
    autoRefreshSeconds,
  });

  const handleUseCurrentLocation = useCallback(
    (assignOrigin = true) => {
      if (!navigator.geolocation) {
        setLocationError('Geolocation is not supported by your browser.');
        return;
      }

      setIsLocating(true);
      setLocationError(null);

      navigator.geolocation.getCurrentPosition(
        async pos => {
          const coords: google.maps.LatLngLiteral = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          setUserLocation(coords);
          setCameraTarget(coords);
          setLiveMapCenter(coords);

          if (assignOrigin) {
            let label = 'Current Location';
            let address = `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
            let placeId: string | undefined;

            if (placesLib?.Place?.searchNearby) {
              try {
                const {places} = await placesLib.Place.searchNearby({
                  fields: ['displayName', 'formattedAddress', 'id'],
                  locationRestriction: {
                    center: coords,
                    radius: 65,
                  },
                  maxResultCount: 1,
                });
                if (places && places.length > 0) {
                  label = places[0].displayName || label;
                  address = places[0].formattedAddress || address;
                  placeId = places[0].id;
                }
              } catch (err) {
                notifyQuotaExceededIfApplicable(err);
              }
            }

            setOrigin({
              id: `gps-${Date.now()}`,
              label,
              address,
              location: coords,
              placeId,
            });
          }

          setIsLocating(false);
        },
        err => {
          setIsLocating(false);
          setLocationError(
            err.code === err.PERMISSION_DENIED
              ? 'Location access was denied. Enable browser location permission to center on your position.'
              : 'Unable to determine your current location.'
          );
        },
        {enableHighAccuracy: true, timeout: 10000, maximumAge: 30000}
      );
    },
    [placesLib]
  );

  const handleQuickSearchSample = useCallback(
    async (query: string, target: 'origin' | 'destination') => {
      if (!placesLib?.Place?.searchByText) return;
      setIsQuickSearching(true);
      setLocationError(null);

      try {
        const {places} = await placesLib.Place.searchByText({
          textQuery: query,
          fields: ['displayName', 'formattedAddress', 'location', 'id'],
          locationBias: {
            center: liveMapCenter,
            radius: 25000,
          },
          maxResultCount: 1,
        });

        const match = places?.[0];
        if (match?.location) {
          const loc = match.location;
          const lat = typeof loc.lat === 'function' ? loc.lat() : Number(loc.lat);
          const lng = typeof loc.lng === 'function' ? loc.lng() : Number(loc.lng);
          const point: LocationPoint = {
            id: match.id || `quick-${Date.now()}`,
            label: match.displayName || query,
            address: match.formattedAddress || match.displayName || query,
            location: {lat, lng},
            placeId: match.id,
          };

          if (target === 'origin') {
            setOrigin(point);
          } else {
            setDestination(point);
          }
          setCameraTarget({lat, lng});
        } else {
          setLocationError(
            `No nearby result found for "${query}" in this map area.`
          );
        }
      } catch (err) {
        notifyQuotaExceededIfApplicable(err);
        setLocationError('Unable to look up nearby hub right now.');
      } finally {
        setIsQuickSearching(false);
      }
    },
    [placesLib, liveMapCenter]
  );

  const handleSwapEndpoints = useCallback(() => {
    setOrigin(destination);
    setDestination(origin);
    if (stops.length > 1) {
      setStops(prev => [...prev].reverse());
    }
  }, [origin, destination, stops.length]);

  const handleAddStop = useCallback(() => {
    if (stops.length >= 10) return;
    setStops(prev => [
      ...prev,
      {
        id: `stop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: '',
        address: '',
        location: liveMapCenter,
      },
    ]);
  }, [stops.length, liveMapCenter]);

  const handleUpdateStop = useCallback(
    (idx: number, pt: LocationPoint | null) => {
      setStops(prev => {
        const next = [...prev];
        if (!pt) {
          next[idx] = {
            ...next[idx],
            label: '',
            address: '',
          };
        } else {
          next[idx] = pt;
        }
        return next;
      });
    },
    []
  );

  const handleRemoveStop = useCallback((idx: number) => {
    setStops(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleMoveStop = useCallback((idx: number, dir: -1 | 1) => {
    setStops(prev => {
      const targetIdx = idx + dir;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(targetIdx, 0, item);
      return next;
    });
  }, []);

  const handlePinDropComplete = useCallback(
    (point: LocationPoint, mode: PinDropMode) => {
      if (mode === 'origin') {
        setOrigin(point);
      } else if (mode === 'destination') {
        setDestination(point);
      } else if (mode === 'stop') {
        setStops(prev => {
          const emptyIdx = prev.findIndex(s => !s.label);
          if (emptyIdx >= 0) {
            const next = [...prev];
            next[emptyIdx] = point;
            return next;
          }
          if (prev.length >= 10) return prev;
          return [...prev, point];
        });
      }
      setPinDropMode('browse');
    },
    []
  );

  const handleFocusStep = useCallback((loc: google.maps.LatLngLiteral) => {
    setFocusLocation({...loc});
    setMobileView('map');
  }, []);

  const combinedError = routeError || locationError;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* 3-Zone Top Bar */}
      <header className="h-14 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => setActivePage('workspace')}
          className="flex items-center gap-2.5 min-w-0 text-left shrink-0"
        >
          <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
            <Compass className="h-4.5 w-4.5" />
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
            MapNavigator
          </span>
        </button>

        <nav
          aria-label="Primary workspace views"
          className="hidden md:flex items-center gap-1"
        >
          {(
            [
              {id: 'plan', label: 'Route Plan'},
              {id: 'traffic', label: 'Live Traffic'},
              {id: 'directions', label: 'Turn-by-Turn'},
            ] as const
          ).map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                setActivePage('workspace');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activePage === 'workspace' && activeTab === item.id
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setActivePage('credits')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activePage === 'credits'
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Credits
          </button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {activePage === 'workspace' ? (
            <button
              type="button"
              onClick={() =>
                setMobileView(v => (v === 'planner' ? 'map' : 'planner'))
              }
              className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0"
            >
              {mobileView === 'planner' ? (
                <>
                  <MapIcon className="h-3.5 w-3.5" />
                  <span>View Map</span>
                </>
              ) : (
                <>
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Planner</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActivePage('workspace')}
              className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0"
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span>Workspace</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setActivePage('workspace');
              handleUseCurrentLocation(!origin);
            }}
            disabled={isLocating}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            {isLocating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Navigation className="h-3.5 w-3.5" />
            )}
            <span>Locate Me</span>
          </button>
        </div>
      </header>

      {activePage === 'credits' ? (
        <CreditsPage onBackToPlanner={() => setActivePage('workspace')} />
      ) : (
      /* Main 2-Pane Split Workspace */
      <main className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        <section
          aria-label="Route planning panel"
          className={`${
            mobileView === 'planner' ? 'flex' : 'hidden'
          } md:flex w-full md:w-[400px] lg:w-[420px] h-full shrink-0 overflow-hidden`}
        >
          <RoutePlannerRail
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            origin={origin}
            destination={destination}
            stops={stops}
            onChangeOrigin={setOrigin}
            onChangeDestination={setDestination}
            onSwapEndpoints={handleSwapEndpoints}
            onAddStop={handleAddStop}
            onUpdateStop={handleUpdateStop}
            onRemoveStop={handleRemoveStop}
            onMoveStop={handleMoveStop}
            travelMode={travelMode}
            onChangeTravelMode={setTravelMode}
            routingPreference={routingPreference}
            onChangeRoutingPreference={setRoutingPreference}
            trafficModel={trafficModel}
            onChangeTrafficModel={setTrafficModel}
            departureInput={departureInput}
            onChangeDepartureInput={setDepartureInput}
            optimizeStopOrder={optimizeStopOrder}
            onToggleOptimizeStopOrder={() => setOptimizeStopOrder(v => !v)}
            avoidTolls={avoidTolls}
            onToggleAvoidTolls={() => setAvoidTolls(v => !v)}
            avoidHighways={avoidHighways}
            onToggleAvoidHighways={() => setAvoidHighways(v => !v)}
            avoidFerries={avoidFerries}
            onToggleAvoidFerries={() => setAvoidFerries(v => !v)}
            autoRefreshSeconds={autoRefreshSeconds}
            onChangeAutoRefreshSeconds={setAutoRefreshSeconds}
            routes={routes}
            selectedRouteIndex={selectedRouteIndex}
            onSelectRoute={setSelectedRouteIndex}
            isLoading={isLoading}
            error={combinedError}
            lastUpdated={lastUpdated}
            onRefreshRoutes={() => void computeRoutes()}
            pinDropMode={pinDropMode}
            onSetPinDropMode={mode => {
              setPinDropMode(mode);
              if (mode !== 'browse') {
                setMobileView('map');
              }
            }}
            onUseCurrentLocation={() => handleUseCurrentLocation(true)}
            isLocating={isLocating}
            mapCenter={liveMapCenter}
            onFocusStep={handleFocusStep}
            onQuickSearchSample={(q, target) =>
              void handleQuickSearchSample(q, target)
            }
            isQuickSearching={isQuickSearching}
            onOpenCredits={() => setActivePage('credits')}
          />
        </section>

        <section
          aria-label="Interactive map canvas"
          className={`${
            mobileView === 'map' ? 'flex' : 'hidden'
          } md:flex flex-1 min-w-0 h-full`}
        >
          <MapViewport
            center={cameraTarget}
            zoom={12}
            theme={theme}
            onToggleTheme={onToggleTheme}
            mapType={mapType}
            onChangeMapType={setMapType}
            showTrafficLayer={showTrafficLayer}
            onToggleTrafficLayer={() => setShowTrafficLayer(v => !v)}
            showTransitLayer={showTransitLayer}
            onToggleTransitLayer={() => setShowTransitLayer(v => !v)}
            origin={origin}
            destination={destination}
            stops={activeStops}
            routes={routes}
            selectedRouteIndex={selectedRouteIndex}
            onSelectRoute={setSelectedRouteIndex}
            pinDropMode={pinDropMode}
            onPinDropComplete={handlePinDropComplete}
            onCancelPinDrop={() => setPinDropMode('browse')}
            userLocation={userLocation}
            focusLocation={focusLocation}
            onCameraCenterChange={setLiveMapCenter}
          />
        </section>
      </main>
      )}
    </div>
  );
}

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white dark:bg-slate-950">
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm shrink-0">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {!MAPS_API_KEY ? (
        <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
          <div className="max-w-md w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                <Compass className="h-4.5 w-4.5" />
              </div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                MapNavigator
              </h1>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Google Maps Platform API key is not configured yet. Set{' '}
              <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                VITE_GOOGLE_MAPS_API_KEY
              </code>{' '}
              in your environment to activate live mapping, route optimization,
              and real-time traffic overlays.
            </p>
          </div>
        </div>
      ) : (
        <APIProvider
          apiKey={MAPS_API_KEY}
          language="en"
          region="US"
          libraries={['routes', 'places', 'marker']}
        >
          <MapNavigatorWorkspace
            theme={theme}
            onToggleTheme={() =>
              setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
            }
          />
        </APIProvider>
      )}
    </div>
  );
}
