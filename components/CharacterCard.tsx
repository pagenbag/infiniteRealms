import React from 'react';
import { Character } from '../types';

interface Props {
  character: Character;
  isActive: boolean;
  onSelect: () => void;
  onStatCheck?: (stat: string, value: number, charName: string) => void;
  onItemUse?: (item: string, charName: string) => void;
}

const CharacterCard: React.FC<Props> = ({ character, isActive, onSelect, onStatCheck, onItemUse }) => {
  const hpPercent = Math.max(0, Math.min(100, (character.hp / character.maxHp) * 100));

  const statsList = [
    { label: 'STR', val: character.stats.str },
    { label: 'DEX', val: character.stats.dex },
    { label: 'CON', val: character.stats.con },
    { label: 'INT', val: character.stats.int },
    { label: 'WIS', val: character.stats.wis },
    { label: 'CHA', val: character.stats.cha },
  ];

  return (
    <div 
      onClick={onSelect}
      className={`
        relative p-4 transition-all duration-200
        border-2 rounded shadow-md overflow-hidden group
        ${isActive ? 'border-parchment-900 bg-parchment-100 scale-[1.02]' : 'border-transparent bg-parchment-300/60 hover:bg-parchment-200 cursor-pointer'}
      `}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-16 h-16 bg-slate-800 rounded-full border-2 border-parchment-800 overflow-hidden flex-shrink-0">
          <img 
            src={character.avatarUrl || `https://picsum.photos/seed/${character.id}/200/200`} 
            alt={character.name}
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
          />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-title font-bold text-lg leading-tight text-parchment-900 truncate">
            {character.name}
          </h3>
          <p className="font-body text-sm text-parchment-800 italic truncate">
            Lvl 1 {character.race} {character.class}
          </p>

          {/* HP Bar */}
          <div className="mt-2 w-full h-3 bg-red-900/20 rounded-full overflow-hidden border border-red-900/30">
            <div 
              className="h-full bg-red-700 transition-all duration-500" 
              style={{ width: `${hpPercent}%` }}
            />
          </div>
          <div className="text-xs text-right mt-0.5 font-mono text-red-900 font-bold">
            {character.hp} / {character.maxHp} HP
          </div>
        </div>
      </div>
      
      {isActive && (
        <div className="mt-4 pt-3 border-t border-parchment-800/20 animate-in fade-in slide-in-from-top-2 duration-300">
          
          {/* Full Stats Grid */}
          <div className="grid grid-cols-3 gap-2 text-center mb-4">
             {statsList.map((stat) => {
               const mod = Math.floor((stat.val - 10) / 2);
               const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
               return (
                 <button 
                    key={stat.label}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatCheck?.(stat.label, stat.val, character.name);
                    }}
                    title="Click to perform ability check"
                    className="bg-parchment-200 p-1 rounded border border-parchment-400 hover:bg-parchment-300 hover:border-parchment-800 transition-colors group/stat"
                 >
                   <div className="text-[10px] uppercase font-bold tracking-wider text-parchment-800">{stat.label}</div>
                   <div className="font-title font-bold text-lg leading-none">{stat.val}</div>
                   <div className="text-[10px] font-mono font-bold text-parchment-600 group-hover/stat:text-parchment-900">{modStr}</div>
                 </button>
               );
             })}
          </div>

          <div className="mb-2">
            <h4 className="font-hand font-bold text-sm border-b border-parchment-800/20 mb-1">Inventory</h4>
            <div className="flex flex-wrap gap-1">
              {character.inventory.map((item, idx) => (
                <button 
                  key={idx} 
                  onClick={(e) => {
                    e.stopPropagation();
                    onItemUse?.(item, character.name);
                  }}
                  title="Use Item"
                  className="text-xs px-1.5 py-0.5 bg-parchment-200 border border-parchment-400 rounded-sm text-parchment-900 hover:bg-parchment-800 hover:text-parchment-100 transition-colors"
                >
                  {item}
                </button>
              ))}
              {character.inventory.length === 0 && <span className="text-xs italic text-parchment-500">Empty</span>}
            </div>
          </div>

          <div className="mb-2">
            <h4 className="font-hand font-bold text-sm border-b border-parchment-800/20 mb-1">Skills</h4>
            <div className="flex flex-wrap gap-1">
              {character.skills.map((skill, idx) => (
                 <button 
                   key={idx}
                   onClick={(e) => {
                     e.stopPropagation();
                     onItemUse?.(skill, character.name); // Treat skills as "Use" for now
                   }}
                   className="text-xs px-1.5 py-0.5 bg-white/40 border border-parchment-400 rounded-sm text-parchment-900 hover:bg-parchment-300 transition-colors"
                 >
                   {skill}
                 </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Status Dot for Multiplayer Simulation */}
      <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${isActive ? 'bg-green-600' : 'bg-transparent'}`} />
    </div>
  );
};

export default CharacterCard;