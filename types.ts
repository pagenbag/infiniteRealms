export enum Theme {
  FANTASY = 'Classic Fantasy',
  SCIFI = 'Sci-Fi Space Opera',
  WESTERN = 'Weird West',
  CYBERPUNK = 'Cyberpunk',
  HORROR = 'Lovecraftian Horror'
}

export interface Character {
  id: string;
  name: string;
  class: string;
  race: string;
  backstory: string;
  hp: number;
  maxHp: number;
  stats: {
    str: number;
    dex: number;
    int: number;
    wis: number;
    cha: number;
    con: number;
  };
  inventory: string[];
  skills: string[];
  avatarUrl?: string; // Placeholder ID for picsum
}

export interface PlayerAction {
  playerId: string;
  action: string;
  status: 'pending' | 'submitted';
}

export interface GameLogEntry {
  id: string;
  type: 'narrative' | 'action' | 'system' | 'roll';
  text: string;
  author?: string; // "DM" or Character Name
  timestamp: number;
}

export interface Campaign {
  id: string;
  title: string;
  theme: Theme;
  description: string;
  isActive: boolean;
  history: GameLogEntry[];
  characters: Character[];
  turnCount: number;
}

// AI Response Structures
export interface AIStateUpdate {
  characterName: string;
  hpChange?: number;
  itemAdded?: string;
  itemRemoved?: string;
}

export interface DMResponse {
  narrative: string;
  updates: AIStateUpdate[];
  suggestedActions?: string[];
}