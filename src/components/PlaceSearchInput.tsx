import React, {useEffect, useRef, useState} from 'react';
import {useMapsLibrary} from '@vis.gl/react-google-maps';
import {Crosshair, Loader2, MapPin, Navigation, X} from 'lucide-react';
import {useAutocompleteSuggestions} from '../hooks/useAutocompleteSuggestions';
import type {LocationPoint} from '../types/navigation';
import {notifyQuotaExceededIfApplicable} from '../utils/quota';

interface PlaceSearchInputProps {
  label: string;
  markerBadge: string;
  badgeColorClass: string;
  placeholder: string;
  value: LocationPoint | null;
  onSelect: (point: LocationPoint | null) => void;
  locationBias?: google.maps.LatLngLiteral | null;
  onRequestPinDrop?: () => void;
  isPinDropActive?: boolean;
  onUseCurrentLocation?: () => void;
  isLocating?: boolean;
}

export function PlaceSearchInput({
  label,
  markerBadge,
  badgeColorClass,
  placeholder,
  value,
  onSelect,
  locationBias,
  onRequestPinDrop,
  isPinDropActive,
  onUseCurrentLocation,
  isLocating,
}: PlaceSearchInputProps) {
  const placesLib = useMapsLibrary('places');

  const [query, setQuery] = useState(value?.label ?? '');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value?.label ?? '');
  }, [value?.id, value?.label]);

  const shouldSearch = isOpen && query.trim() !== (value?.label ?? '').trim();
  const {suggestions, isLoading, error, resetSession} =
    useAutocompleteSuggestions(shouldSearch ? query : '', locationBias);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  async function handleSelectSuggestion(
    suggestion: google.maps.places.AutocompleteSuggestion
  ) {
    if (!placesLib || !suggestion.placePrediction) return;
    setIsFetchingDetails(true);
    setIsOpen(false);

    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'id'],
      });

      const loc = place.location;
      if (loc) {
        const lat = typeof loc.lat === 'function' ? loc.lat() : Number(loc.lat);
        const lng = typeof loc.lng === 'function' ? loc.lng() : Number(loc.lng);
        const displayName =
          place.displayName ||
          suggestion.placePrediction.mainText?.text ||
          suggestion.placePrediction.text?.text ||
          'Selected location';
        const formattedAddress =
          place.formattedAddress ||
          suggestion.placePrediction.text?.text ||
          displayName;

        onSelect({
          id: place.id || `${lat.toFixed(5)},${lng.toFixed(5)}-${Date.now()}`,
          label: displayName,
          address: formattedAddress,
          location: {lat, lng},
          placeId: place.id,
        });
        setQuery(displayName);
      }
    } catch (err) {
      notifyQuotaExceededIfApplicable(err);
    } finally {
      resetSession();
      setIsFetchingDetails(false);
      setActiveIndex(-1);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev =>
        prev <= 0 ? suggestions.length - 1 : prev - 1
      );
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      void handleSelectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums ${badgeColorClass}`}
          aria-hidden="true"
        >
          {markerBadge}
        </span>

        <div className="relative flex-1 min-w-0">
          <label className="sr-only">{label}</label>
          <input
            type="text"
            value={query}
            onFocus={() => setIsOpen(true)}
            onChange={e => {
              setQuery(e.target.value);
              setIsOpen(true);
              setActiveIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label={label}
            className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-3 pr-20 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-colors truncate"
          />

          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            {(isLoading || isFetchingDetails) && (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400 mr-1" />
            )}

            {query && !isFetchingDetails && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  onSelect(null);
                  resetSession();
                  setIsOpen(false);
                }}
                aria-label={`Clear ${label}`}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {onUseCurrentLocation && (
              <button
                type="button"
                onClick={onUseCurrentLocation}
                disabled={isLocating}
                title="Use current GPS location"
                aria-label="Use current GPS location"
                className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {isLocating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Navigation className="h-3.5 w-3.5" />
                )}
              </button>
            )}

            {onRequestPinDrop && (
              <button
                type="button"
                onClick={onRequestPinDrop}
                title={`Pick ${label} on map`}
                aria-label={`Pick ${label} on map`}
                aria-pressed={isPinDropActive}
                className={`p-1.5 rounded-md transition-colors ${
                  isPinDropActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Crosshair className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {value?.address && value.address !== value.label && !isOpen && (
        <p className="mt-1 pl-8 text-xs text-slate-500 dark:text-slate-400 truncate">
          {value.address}
        </p>
      )}

      {isOpen && shouldSearch && (suggestions.length > 0 || error) && (
        <div
          role="listbox"
          className="absolute left-8 right-0 top-11 z-40 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden max-h-64 overflow-y-auto"
        >
          {error ? (
            <div className="px-3 py-2.5 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          ) : (
            suggestions.map((s, idx) => {
              const mainText =
                s.placePrediction?.mainText?.text ||
                s.placePrediction?.text?.text ||
                '';
              const secondaryText =
                s.placePrediction?.secondaryText?.text || '';

              return (
                <button
                  key={`${s.placePrediction?.placeId ?? idx}`}
                  type="button"
                  role="option"
                  aria-selected={idx === activeIndex}
                  onMouseDown={e => {
                    e.preventDefault();
                    void handleSelectSuggestion(s);
                  }}
                  className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 border-b last:border-b-0 border-slate-100 dark:border-slate-800 transition-colors ${
                    idx === activeIndex
                      ? 'bg-blue-50 dark:bg-blue-950/50'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <MapPin className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {mainText}
                    </div>
                    {secondaryText && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {secondaryText}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
