export interface UserSettings {
  appearance?: 'Dark' | 'Light' | 'System';
  defaultQuality?: 'Auto' | '480p' | '720p' | '1080p';
  autoplayNext?: boolean;
  rememberPosition?: boolean;
  newEpisodeNotifications?: boolean;
}

export interface User {
  uid: string;
  id?: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'user' | 'admin';
  isBanned?: boolean;
  createdAt: number;
  settings?: UserSettings;
}

export interface DubCredits {
  studio: string;
  presentedBy: string;
  voiceDirector: string;
  translator: string;
  scriptAdapter: string;
  audioEngineer: string;
  mixingMastering: string;
  voiceCast: { role: string; actor: string }[];
}

export interface Anime {
  id: string;
  title: string;
  description: string;
  posterUrl: string;
  bannerUrl: string;
  genres: string[];
  studio?: string;
  language?: string;
  status: 'Ongoing' | 'Completed' | 'Upcoming' | string;
  releaseYear: number | string;
  rating: number | string;
  featured: boolean;
  trending?: boolean;
  type?: 'TV Series' | 'Movie' | string;
  contentType?: 'TV Series' | 'Movie' | string;
  duration?: string;
  releaseDate?: string;
  server1Url?: string;
  server1_url?: string;
  server2Url?: string;
  server2_url?: string;
  server3Url?: string;
  server3_url?: string;
  isMovie?: boolean;
  views?: number;
  dubbedBy?: string;
  dubCredits?: DubCredits;
  createdAt?: any;
  updatedAt?: any;
}

export interface Season {
  id: string;
  animeId: string;
  seasonNumber: number;
  title: string;
  description?: string;
  posterUrl?: string;
  bannerUrl?: string;
  releaseYear?: number;
  status?: 'Ongoing' | 'Completed';
  createdAt: number;
}

export interface Episode {
  id: string;
  animeId: string;
  seasonId: string;
  episodeNumber: number;
  title: string;
  thumbnailUrl: string;
  server1Url?: string;
  server1_url?: string;
  abyssUrl?: string;
  abyss_url?: string;
  server2Url?: string;
  server2_url?: string;
  filemoonUrl?: string;
  filemoon_url?: string;
  server3Url?: string;
  server3_url?: string;
  vdohideUrl?: string;
  vdohide_url?: string;
  videoUrl?: string;
  duration?: number | string;
  createdAt?: number;
}

export interface Comment {
  id: string;
  animeId: string;
  episodeId?: string;
  userId: string;
  userName: string;
  userPhoto: string;
  text: string;
  createdAt: number;
}

export interface WatchHistory {
  id: string;
  userId: string;
  animeId: string;
  episodeId: string;
  progress: number;
  duration: number;
  watchedAt: number;
}

export interface Favorite {
  id: string;
  userId: string;
  animeId: string;
  createdAt: number;
}
