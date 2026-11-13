import React, {useEffect, useRef, useState} from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  Edit3,
  Mail,
  MapPin,
  RotateCcw,
  User,
} from 'lucide-react';
import defaultCreatorPortrait from '../assets/images/creator_portrait_1794571307162.jpg';

interface CreatorProfile {
  name: string;
  role: string;
  email: string;
  location: string;
  bio: string;
}

const DEFAULT_PROFILE: CreatorProfile = {
  name: 'Rasheed',
  role: 'Creator & Product Architect',
  email: 'rasheedpsh2016@gmail.com',
  location: 'MapNavigator Project',
  bio: 'Designed and engineered MapNavigator to unify real-time traffic corridor analytics, multi-stop waypoint optimization, and clear turn-by-turn routing in a single workspace.',
};

const PROFILE_STORAGE_KEY = 'mapnavigator_creator_profile_v1';
const PHOTO_STORAGE_KEY = 'mapnavigator_creator_photo_v1';

interface CreditsPageProps {
  onBackToPlanner: () => void;
}

function resizeImageToDataUrl(file: File, maxDim = 720): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.onerror = () => reject(new Error('Invalid image file selected.'));
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

export function CreditsPage({onBackToPlanner}: CreditsPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<CreatorProfile>(() => {
    try {
      const saved = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      if (saved) {
        return {...DEFAULT_PROFILE, ...JSON.parse(saved)};
      }
    } catch {
      // Ignore storage read errors
    }
    return DEFAULT_PROFILE;
  });

  const [customPhoto, setCustomPhoto] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(PHOTO_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const [imgFailed, setImgFailed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<CreatorProfile>(profile);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  const activePhotoSrc = customPhoto || defaultCreatorPortrait;

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose a PNG, JPG, or WebP image file.');
      return;
    }

    setPhotoError(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setCustomPhoto(dataUrl);
      setImgFailed(false);
      try {
        window.localStorage.setItem(PHOTO_STORAGE_KEY, dataUrl);
      } catch {
        setPhotoError(
          'Photo preview updated, though browser storage limit prevented saving across reloads.'
        );
      }
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : 'Unable to load selected photo.'
      );
    }
  }

  function handleResetPhoto() {
    setCustomPhoto(null);
    setImgFailed(false);
    setPhotoError(null);
    try {
      window.localStorage.removeItem(PHOTO_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    const cleaned: CreatorProfile = {
      name: draft.name.trim() || DEFAULT_PROFILE.name,
      role: draft.role.trim() || DEFAULT_PROFILE.role,
      email: draft.email.trim() || DEFAULT_PROFILE.email,
      location: draft.location.trim() || DEFAULT_PROFILE.location,
      bio: draft.bio.trim() || DEFAULT_PROFILE.bio,
    };
    setProfile(cleaned);
    setIsEditing(false);
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(cleaned));
    } catch {
      // Ignore storage errors
    }
  }

  return (
    <main className="flex-1 min-h-0 overflow-y-auto nav-scroll bg-slate-50 dark:bg-slate-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-10">
        {/* Page Header & Return Action */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              MapNavigator · Project Credits & Attribution
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Created by {profile.name}
            </h1>
          </div>

          <button
            type="button"
            onClick={onBackToPlanner}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Route Planner</span>
          </button>
        </div>

        {/* Creator Spotlight Card */}
        <section
          aria-label="Creator profile"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8"
        >
          <div className="flex flex-col md:flex-row items-start gap-6 sm:gap-8">
            {/* Portrait Column */}
            <div className="flex flex-col items-start gap-3 shrink-0">
              <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                {!imgFailed ? (
                  <img
                    src={activePhotoSrc}
                    alt={`${profile.name} portrait`}
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500 p-4 text-center">
                    <User className="h-10 w-10" />
                    <span className="text-xs font-medium">{profile.name}</span>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                aria-label="Upload creator picture"
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>{customPhoto ? 'Change Picture' : 'Upload My Picture'}</span>
                </button>

                {customPhoto && (
                  <button
                    type="button"
                    onClick={handleResetPhoto}
                    title="Restore default portrait"
                    aria-label="Restore default portrait"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {photoError && (
                <p className="text-xs text-red-600 dark:text-red-400 max-w-[12rem]">
                  {photoError}
                </p>
              )}
            </div>

            {/* Bio & Details Column */}
            <div className="flex-1 min-w-0 w-full">
              {!isEditing ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        {profile.role}
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {profile.name}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit Profile</span>
                    </button>
                  </div>

                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                    {profile.bio}
                  </p>

                  <div className="pt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                    <a
                      href={`mailto:${profile.email}`}
                      className="inline-flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>{profile.email}</span>
                    </a>

                    <span className="inline-flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>{profile.location}</span>
                    </span>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="creator-name"
                        className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                      >
                        Display Name
                      </label>
                      <input
                        id="creator-name"
                        type="text"
                        value={draft.name}
                        onChange={e =>
                          setDraft(d => ({...d, name: e.target.value}))
                        }
                        className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="creator-role"
                        className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                      >
                        Role / Title
                      </label>
                      <input
                        id="creator-role"
                        type="text"
                        value={draft.role}
                        onChange={e =>
                          setDraft(d => ({...d, role: e.target.value}))
                        }
                        className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="creator-email"
                        className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                      >
                        Contact Email
                      </label>
                      <input
                        id="creator-email"
                        type="email"
                        value={draft.email}
                        onChange={e =>
                          setDraft(d => ({...d, email: e.target.value}))
                        }
                        className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="creator-location"
                        className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                      >
                        Location / Studio
                      </label>
                      <input
                        id="creator-location"
                        type="text"
                        value={draft.location}
                        onChange={e =>
                          setDraft(d => ({...d, location: e.target.value}))
                        }
                        className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="creator-bio"
                      className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                    >
                      About & Project Notes
                    </label>
                    <textarea
                      id="creator-bio"
                      rows={3}
                      value={draft.bio}
                      onChange={e =>
                        setDraft(d => ({...d, bio: e.target.value}))
                      }
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Save Changes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(profile);
                        setIsEditing(false);
                      }}
                      className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* Core Engineering Pillars */}
        <section
          aria-label="Project architecture credits"
          className="border-t border-slate-200 dark:border-slate-800 pt-8 space-y-5"
        >
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            01. Core Capabilities & Engineering
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Optimized Route Planning
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Multi-stop waypoint reordering, departure scheduling, and toll,
                highway, and ferry modifiers across five travel modes.
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Real-Time Traffic Telemetry
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Live speed-segmented route polylines comparing current delay
                against free-flow travel times with clickable alternatives.
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Places & Geolocation Discovery
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Session-tokenized Places Autocomplete, browser GPS origin
                detection, and interactive map pin-dropping.
              </p>
            </div>
          </div>
        </section>

        {/* Platform & Open Source Attributions */}
        <section
          aria-label="Platform and open source credits"
          className="border-t border-slate-200 dark:border-slate-800 pt-8 space-y-4"
        >
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            02. Platform & Open-Source Attributions
          </h2>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
            {[
              {
                name: 'Google Maps Platform',
                role: 'Maps JavaScript API, Routes API, Places API (New), Traffic & Transit Layers',
              },
              {
                name: '@vis.gl/react-google-maps',
                role: 'React map viewport, AdvancedMarker, Pin, and InfoWindow bindings',
              },
              {
                name: 'React, TypeScript & Vite',
                role: 'Application architecture, strict type safety, and production bundling',
              },
              {
                name: 'Tailwind CSS & Lucide Icons',
                role: 'Responsive light/dark interface styling and navigation iconography',
              },
            ].map(item => (
              <div
                key={item.name}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4"
              >
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {item.name}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {item.role}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
