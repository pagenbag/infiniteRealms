import React, { useState, useEffect, useRef } from 'react';
import { Theme, Character, Campaign, GameLogEntry, PlayerAction, DMResponse } from './types';
import * as gemini from './services/geminiService';
import CharacterCard from './components/CharacterCard';
import Dice from './components/Dice';

// Simple ID gen
const generateId = () => Math.random().toString(36).substr(2, 9);

const THEME_PRESETS: Record<Theme, { races: string[]; classes: string[] }> = {
  [Theme.FANTASY]: {
    races: ['Human', 'Elf', 'Dwarf', 'Halfling', 'Orc', 'Tiefling', 'Dragonborn', 'Gnome'],
    classes: ['Fighter', 'Wizard', 'Rogue', 'Cleric', 'Paladin', 'Ranger', 'Bard', 'Barbarian', 'Druid', 'Monk', 'Sorcerer', 'Warlock']
  },
  [Theme.SCIFI]: {
    races: ['Human', 'Android', 'Grey Alien', 'Martian', 'Cyborg', 'Hologram', 'Reptilian'],
    classes: ['Pilot', 'Soldier', 'Engineer', 'Medic', 'Bounty Hunter', 'Psychic', 'Diplomat', 'Smuggler']
  },
  [Theme.WESTERN]: {
    races: ['Human', 'Revenant', 'Spirit-Touched'], 
    classes: ['Gunslinger', 'Sheriff', 'Outlaw', 'Preacher', 'Gambler', 'Prospector', 'Bounty Hunter', 'Doc']
  },
  [Theme.CYBERPUNK]: {
    races: ['Human', 'Cyborg', 'Synthetic', 'Bio-Modded'],
    classes: ['Street Samurai', 'Netrunner', 'Techie', 'Solo', 'Fixer', 'Rockerboy', 'Corpo']
  },
  [Theme.HORROR]: {
    races: ['Human', 'Vampire', 'Werewolf', 'Ghost', 'Medium', 'Awakened'],
    classes: ['Investigator', 'Occultist', 'Survivor', 'Hunter', 'Medium', 'Professor', 'Priest']
  }
};

const STAT_BASE = 8;
const MAX_STAT = 18;
const MIN_STAT = 3;
const TOTAL_POINTS = 27;

const App: React.FC = () => {
  // --- State ---
  const [view, setView] = useState<'lobby' | 'campaign-select' | 'char-creation' | 'game'>('lobby');
  const [theme, setTheme] = useState<Theme>(Theme.FANTASY);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  
  // Creation State
  const [campaignOptions, setCampaignOptions] = useState<Array<{title: string, description: string}>>([]);
  const [isCustomCampaign, setIsCustomCampaign] = useState(false);
  const [customCampaignData, setCustomCampaignData] = useState({ title: '', description: '' });

  const [creationPrompt, setCreationPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Manual Creation Form
  const [manualForm, setManualForm] = useState({
    name: '',
    race: '', // Will default in effect
    class: '', // Will default in effect
    stats: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
    backstory: '',
    avatarUrl: ''
  });

  // Calculate used points: (Stat - Base) * 1. Simple 1-to-1 cost for this implementation.
  const pointsUsed = Object.values(manualForm.stats).reduce((acc, val) => acc + (val - STAT_BASE), 0);
  const pointsRemaining = TOTAL_POINTS - pointsUsed;

  // Game Loop State
  const [turnActions, setTurnActions] = useState<PlayerAction[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [notes, setNotes] = useState('');

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // --- Effects ---
  useEffect(() => {
    // Scroll to bottom of chat
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [campaign?.history]);

  useEffect(() => {
    // Default race/class when theme changes
    const presets = THEME_PRESETS[theme];
    setManualForm(prev => ({
      ...prev,
      race: prev.race || presets.races[0],
      class: prev.class || presets.classes[0]
    }));
  }, [theme]);

  useEffect(() => {
    // Load saved game from local storage on mount
    const saved = localStorage.getItem('aethelgard_save');
    if (saved) {
      try {
        JSON.parse(saved);
      } catch(e) { console.error(e) }
    }
  }, []);

  const saveGame = () => {
    if (campaign && characters.length > 0) {
      const saveState = {
        campaign,
        characters,
        theme
      };
      localStorage.setItem('aethelgard_save', JSON.stringify(saveState));
      alert("Game Saved!");
    }
  };

  const loadGame = () => {
      const saved = localStorage.getItem('aethelgard_save');
      if (saved) {
          try {
              const parsed = JSON.parse(saved);
              setCampaign(parsed.campaign);
              setCharacters(parsed.characters);
              setTheme(parsed.theme);
              if (parsed.characters.length > 0) setActivePlayerId(parsed.characters[0].id);
              setView('game');
          } catch(e) {
              alert("Failed to load save file.");
          }
      } else {
          alert("No save game found.");
      }
  }

  // --- Handlers ---

  const handleThemeSelect = async (selectedTheme: Theme) => {
    setTheme(selectedTheme);
    setIsGenerating(true);
    // Reset custom campaign state
    setIsCustomCampaign(false);
    setCustomCampaignData({ title: '', description: '' });
    
    try {
        const options = await gemini.generateCampaignOptions(selectedTheme);
        setCampaignOptions(options);
        setView('campaign-select');
    } catch (e) {
        alert("Failed to generate campaigns. Please check API Key.");
    } finally {
        setIsGenerating(false);
    }
  };

  const startCampaign = (title: string, desc: string) => {
    const newCampaign: Campaign = {
      id: generateId(),
      title,
      description: desc,
      theme,
      isActive: true,
      history: [{
        id: generateId(),
        type: 'narrative',
        text: `Welcome to ${title}. ${desc} The adventure begins...`,
        timestamp: Date.now(),
        author: 'Dungeon Master'
      }],
      characters: [],
      turnCount: 0
    };
    setCampaign(newCampaign);
    setView('char-creation');
  };

  const generatePortrait = async () => {
    if (!manualForm.name) return;
    setIsGenerating(true);
    const desc = `${manualForm.race} ${manualForm.class}, ${manualForm.backstory || 'heroic pose'}`;
    const img = await gemini.generateCharacterImage(desc);
    if (img) setManualForm(prev => ({ ...prev, avatarUrl: img }));
    setIsGenerating(false);
  }

  const handleStatChange = (stat: keyof typeof manualForm.stats, delta: number) => {
    const currentVal = manualForm.stats[stat];
    const newVal = currentVal + delta;
    
    // Check bounds
    if (newVal < MIN_STAT) return;
    if (newVal > MAX_STAT) return;
    
    // Check points
    if (delta > 0 && pointsRemaining <= 0) return;

    setManualForm(prev => ({
      ...prev,
      stats: { ...prev.stats, [stat]: newVal }
    }));
  };

  const handleAiPopulate = async (isRandom: boolean) => {
    setIsGenerating(true);
    try {
        const prompt = isRandom ? '' : creationPrompt;
        const options = THEME_PRESETS[theme];
        const charData = await gemini.generateCharacter(theme, prompt, options);
        
        // Auto gen portrait for AI characters
        let avatarUrl = manualForm.avatarUrl;
        if (charData.name && charData.race && charData.class) {
            const desc = `${charData.race} ${charData.class} named ${charData.name}, ${theme} style`;
            const img = await gemini.generateCharacterImage(desc);
            if (img) avatarUrl = img;
        }

        // Map AI stats to form, clamping if needed, but for now we accept AI values 
        // We will try to map AI strings to our dropdowns if they match loosely
        let matchedRace = options.races[0];
        let matchedClass = options.classes[0];

        if (charData.race) {
          const found = options.races.find(r => r.toLowerCase() === charData.race?.toLowerCase());
          if (found) matchedRace = found;
          else matchedRace = charData.race; // Keep AI string if distinct (will add to dropdown momentarily or just display)
        }
        if (charData.class) {
          const found = options.classes.find(c => c.toLowerCase() === charData.class?.toLowerCase());
          if (found) matchedClass = found;
          else matchedClass = charData.class;
        }

        setManualForm({
            name: charData.name || '',
            race: matchedRace,
            class: matchedClass,
            backstory: charData.backstory || '',
            stats: charData.stats || { str:8, dex:8, con:8, int:8, wis:8, cha:8 },
            avatarUrl: avatarUrl
        });

    } catch (e) {
        console.error(e);
        alert("AI summoning failed.");
    } finally {
        setIsGenerating(false);
    }
  };

  const handleCreateConfirm = () => {
    const newChar: Character = {
        id: generateId(),
        name: manualForm.name || 'Unknown',
        class: manualForm.class,
        race: manualForm.race,
        backstory: manualForm.backstory || '',
        hp: 10 + Math.floor((manualForm.stats.con - 10) / 2),
        maxHp: 10 + Math.floor((manualForm.stats.con - 10) / 2),
        stats: manualForm.stats,
        inventory: ['Backpack', 'Rations'],
        skills: ['Perception'],
        avatarUrl: manualForm.avatarUrl
    };

    setCharacters(prev => [...prev, newChar]);
    setCreationPrompt('');
    // Reset form
    setManualForm({ 
        name: '', 
        race: THEME_PRESETS[theme].races[0], 
        class: THEME_PRESETS[theme].classes[0], 
        stats: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }, 
        backstory: '', 
        avatarUrl: '' 
    });
  };

  const startGame = () => {
    if (characters.length === 0) {
      alert("You need at least one adventurer!");
      return;
    }
    setActivePlayerId(characters[0].id);
    setView('game');
  };

  const submitAction = (actionText: string = currentInput) => {
    if (!actionText.trim() || !activePlayerId) return;
    
    // Check if this player already acted this turn
    const existingActionIdx = turnActions.findIndex(a => a.playerId === activePlayerId);
    
    if (existingActionIdx >= 0) {
        // Update existing action
        const newActions = [...turnActions];
        newActions[existingActionIdx].action = actionText;
        setTurnActions(newActions);
    } else {
        // Add new action
        setTurnActions(prev => [...prev, {
            playerId: activePlayerId,
            action: actionText,
            status: 'submitted'
        }]);
    }
    
    setCurrentInput('');
  };

  const cancelAction = (playerId: string) => {
      setTurnActions(prev => prev.filter(a => a.playerId !== playerId));
  };

  const endTurn = async () => {
    if (!campaign) return;
    
    setIsGenerating(true);
    
    const formattedActions = turnActions.map(action => {
        const char = characters.find(c => c.id === action.playerId);
        return {
            characterName: char?.name || "Unknown",
            action: action.action
        };
    });

    try {
        const dmResponse = await gemini.processTurn(
            campaign.title, 
            theme, 
            characters, 
            campaign.history, 
            formattedActions
        );

        const newLog: GameLogEntry[] = [];
        
        turnActions.forEach(act => {
             const char = characters.find(c => c.id === act.playerId);
             newLog.push({
                 id: generateId(),
                 type: 'action',
                 text: act.action,
                 author: char?.name,
                 timestamp: Date.now()
             });
        });

        newLog.push({
            id: generateId(),
            type: 'narrative',
            text: dmResponse.narrative,
            author: 'Dungeon Master',
            timestamp: Date.now()
        });

        const updatedCharacters = [...characters];
        const systemMessages: string[] = [];

        dmResponse.updates.forEach(update => {
            const charIdx = updatedCharacters.findIndex(c => c.name === update.characterName);
            if (charIdx > -1) {
                const char = updatedCharacters[charIdx];
                if (update.hpChange) {
                    char.hp = Math.max(0, Math.min(char.maxHp, char.hp + update.hpChange));
                    systemMessages.push(`${char.name} ${update.hpChange > 0 ? 'healed' : 'took damage'}: ${Math.abs(update.hpChange)} HP.`);
                }
                if (update.itemAdded) {
                    char.inventory.push(update.itemAdded);
                    systemMessages.push(`${char.name} obtained: ${update.itemAdded}`);
                }
                if (update.itemRemoved) {
                    char.inventory = char.inventory.filter(i => i !== update.itemRemoved);
                    systemMessages.push(`${char.name} lost: ${update.itemRemoved}`);
                }
                updatedCharacters[charIdx] = char;
            }
        });

        if (systemMessages.length > 0) {
            newLog.push({
                id: generateId(),
                type: 'system',
                text: systemMessages.join(' | '),
                timestamp: Date.now()
            });
        }

        setCampaign(prev => prev ? ({
            ...prev,
            history: [...prev.history, ...newLog],
            turnCount: prev.turnCount + 1
        }) : null);
        setCharacters(updatedCharacters);
        setTurnActions([]); 

    } catch (e) {
        console.error(e);
        alert("The Dungeon Master is confused. Try again.");
    } finally {
        setIsGenerating(false);
    }
  };

  const handleRoll = (result: number) => {
     if (!campaign || !activePlayerId) return;
     const char = characters.find(c => c.id === activePlayerId);
     const logEntry: GameLogEntry = {
         id: generateId(),
         type: 'roll',
         text: `rolled a ${result}`,
         author: char?.name,
         timestamp: Date.now()
     };
     setCampaign(prev => prev ? ({...prev, history: [...prev.history, logEntry]}) : null);
  };

  const handleStatCheck = (stat: string, value: number, charName: string) => {
    if (!campaign) return;
    const modifier = Math.floor((value - 10) / 2);
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + modifier;
    
    let flavor = "";
    if (d20 === 20) flavor = "CRITICAL SUCCESS! ";
    if (d20 === 1) flavor = "CRITICAL FAIL! ";
    
    const text = `${flavor}Rolled ${d20} + ${modifier} = ${total} for ${stat} Check`;
    
    setCampaign(prev => prev ? ({
        ...prev, 
        history: [...prev.history, {
            id: generateId(),
            type: 'roll',
            text: text,
            author: charName,
            timestamp: Date.now()
        }]
    }) : null);
  };

  const handleItemUse = (item: string, charName: string) => {
    setCurrentInput(`Uses ${item}...`);
  };

  // --- Views ---

  if (view === 'lobby') {
    return (
      <div className="min-h-screen bg-parchment-200 flex flex-col items-center justify-center p-8 font-title relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
            backgroundImage: "radial-gradient(circle at center, #5c4b36 1px, transparent 1px)",
            backgroundSize: "40px 40px"
        }}></div>

        <div className="z-10 bg-parchment-100 p-12 rounded-lg shadow-2xl border-4 border-parchment-800 text-center max-w-2xl w-full paper-shadow">
          <h1 className="text-6xl font-bold mb-4 text-parchment-900 tracking-tighter">Infinite Realms Tabletop</h1>
          <p className="font-body text-xl text-parchment-800 mb-12 italic">An Endless Adventure awaiting your party.</p>
          
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-parchment-900 border-b-2 border-parchment-800/20 pb-2">Select a Theme to Begin</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.values(Theme).map(t => (
                <button
                  key={t}
                  disabled={isGenerating}
                  onClick={() => handleThemeSelect(t)}
                  className="p-4 bg-parchment-800 text-parchment-100 rounded hover:bg-parchment-900 transition-colors font-bold text-lg disabled:opacity-50"
                >
                  {t}
                </button>
              ))}
            </div>
            
             <div className="pt-6 border-t border-parchment-800/20 mt-6">
                 <button onClick={loadGame} className="text-parchment-900 underline font-hand text-xl hover:text-parchment-800">
                     Continue saved campaign
                 </button>
             </div>

            {isGenerating && <div className="mt-4 text-parchment-900 font-bold animate-pulse">The Weaver is thinking...</div>}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'campaign-select') {
      if (isCustomCampaign) {
          return (
             <div className="min-h-screen bg-parchment-200 p-8 flex flex-col items-center justify-center font-body">
                 <div className="bg-parchment-100 p-8 rounded shadow-lg border-2 border-parchment-800 max-w-2xl w-full paper-shadow">
                     <h2 className="font-title text-3xl mb-6 text-parchment-900">Custom Homebrew Campaign</h2>
                     
                     <div className="space-y-4">
                        <div>
                            <label className="block font-bold mb-2">Campaign Title</label>
                            <input 
                                className="w-full p-2 bg-parchment-200 border border-parchment-400 rounded font-title text-lg"
                                value={customCampaignData.title}
                                onChange={(e) => setCustomCampaignData({...customCampaignData, title: e.target.value})}
                                placeholder="The Dark Tower of Zorg..."
                            />
                        </div>
                        <div>
                            <label className="block font-bold mb-2">Premise / Description</label>
                            <textarea 
                                className="w-full h-32 p-2 bg-parchment-200 border border-parchment-400 rounded resize-none"
                                value={customCampaignData.description}
                                onChange={(e) => setCustomCampaignData({...customCampaignData, description: e.target.value})}
                                placeholder="A group of adventurers meet in a tavern to discuss a map to a lost treasure..."
                            />
                        </div>
                     </div>

                     <div className="mt-8 flex justify-between">
                         <button 
                            onClick={() => setIsCustomCampaign(false)}
                            className="text-parchment-800 underline hover:text-parchment-900"
                         >
                             Back to List
                         </button>
                         <button 
                            onClick={() => startCampaign(customCampaignData.title, customCampaignData.description)}
                            disabled={!customCampaignData.title || !customCampaignData.description}
                            className="bg-parchment-800 text-parchment-100 px-6 py-2 rounded font-bold hover:bg-ink disabled:opacity-50"
                         >
                             Start Homebrew
                         </button>
                     </div>
                 </div>
             </div>
          );
      }

      return (
          <div className="min-h-screen bg-parchment-200 p-8 flex flex-col items-center">
              <h2 className="font-title text-4xl mb-8 text-parchment-900">Choose Your Adventure</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full">
                  {campaignOptions.map((opt, i) => (
                      <div key={i} className="bg-parchment-100 p-6 rounded shadow-lg border-2 border-parchment-800 flex flex-col paper-shadow hover:-translate-y-1 transition-transform">
                          <h3 className="font-title text-2xl font-bold mb-4">{opt.title}</h3>
                          <p className="font-body text-lg flex-1 mb-6">{opt.description}</p>
                          <button 
                            onClick={() => startCampaign(opt.title, opt.description)}
                            className="bg-parchment-800 text-parchment-100 py-3 rounded font-bold hover:bg-ink"
                          >
                              Embark
                          </button>
                      </div>
                  ))}
                  
                  {/* Custom Option Card */}
                  <div className="bg-parchment-300/50 p-6 rounded shadow-lg border-2 border-dashed border-parchment-800 flex flex-col items-center justify-center hover:bg-parchment-200 transition-colors cursor-pointer group" onClick={() => setIsCustomCampaign(true)}>
                       <div className="text-6xl text-parchment-800 mb-4 group-hover:scale-110 transition-transform">+</div>
                       <h3 className="font-title text-2xl font-bold text-parchment-900">Create Homebrew</h3>
                       <p className="text-center text-parchment-800 mt-2">Write your own custom campaign premise.</p>
                  </div>
              </div>
          </div>
      )
  }

  if (view === 'char-creation') {
    return (
      <div className="min-h-screen bg-parchment-200 p-6 font-body">
        <div className="max-w-6xl mx-auto bg-parchment-100 min-h-[80vh] rounded shadow-xl border-2 border-parchment-800 p-8 relative paper-shadow">
          <h2 className="font-title text-3xl mb-2 text-center text-parchment-900">Gather Your Party</h2>
          <p className="text-center text-parchment-800 mb-8 italic">Create characters or ask the fates to provide them.</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              
              {/* AI Prompt Section */}
              <div className="bg-parchment-200 p-4 rounded border border-parchment-300 shadow-inner">
                  <h3 className="font-title font-bold mb-2">AI Summoner</h3>
                  <textarea 
                    className="w-full h-20 bg-parchment-100 border border-parchment-400 rounded p-2 focus:ring-2 focus:ring-parchment-800 focus:outline-none resize-none mb-4"
                    placeholder="Describe your hero (e.g. 'A grumpy dwarven blacksmith...'). Leave empty for random."
                    value={creationPrompt}
                    onChange={(e) => setCreationPrompt(e.target.value)}
                  />
                  <div className="flex gap-4">
                     <button 
                      onClick={() => handleAiPopulate(true)}
                      disabled={isGenerating}
                      className="flex-1 bg-parchment-800 text-parchment-100 py-2 rounded font-bold disabled:opacity-50 hover:bg-ink flex items-center justify-center gap-2"
                    >
                      <span>🎲</span> Randomize
                    </button>
                    <button 
                      onClick={() => handleAiPopulate(false)}
                      disabled={isGenerating}
                      className="flex-1 bg-parchment-800 text-parchment-100 py-2 rounded font-bold disabled:opacity-50 hover:bg-ink flex items-center justify-center gap-2"
                    >
                      <span>✨</span> Summon via Prompt
                    </button>
                  </div>
              </div>

              {/* Character Form */}
              <div className="bg-white/40 p-6 rounded border border-parchment-300 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs font-bold uppercase mb-1">Name</label>
                        <input 
                            className="w-full p-2 rounded bg-parchment-100 border border-parchment-400 font-bold"
                            value={manualForm.name} 
                            onChange={e => setManualForm({...manualForm, name: e.target.value})}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1">Race</label>
                        <select 
                            className="w-full p-2 rounded bg-parchment-100 border border-parchment-400"
                            value={manualForm.race} 
                            onChange={e => setManualForm({...manualForm, race: e.target.value})}
                        >
                            {THEME_PRESETS[theme].races.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                            {/* Fallback if AI generated something wild */}
                            {!THEME_PRESETS[theme].races.includes(manualForm.race) && manualForm.race && (
                                <option value={manualForm.race}>{manualForm.race}</option>
                            )}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase mb-1">Class</label>
                        <select 
                            className="w-full p-2 rounded bg-parchment-100 border border-parchment-400"
                            value={manualForm.class} 
                            onChange={e => setManualForm({...manualForm, class: e.target.value})}
                        >
                             {THEME_PRESETS[theme].classes.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                            {!THEME_PRESETS[theme].classes.includes(manualForm.class) && manualForm.class && (
                                <option value={manualForm.class}>{manualForm.class}</option>
                            )}
                        </select>
                    </div>
                  </div>
                  
                  {/* Point Buy Stats Grid */}
                  <div>
                      <div className="flex justify-between items-center mb-2 border-b border-parchment-400 pb-1">
                          <label className="text-sm font-bold uppercase">Ability Scores</label>
                          <span className={`text-sm font-bold font-mono ${pointsRemaining < 0 ? 'text-red-600' : 'text-green-800'}`}>
                              Points Remaining: {pointsRemaining}
                          </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {Object.keys(manualForm.stats).map(statKey => {
                             const key = statKey as keyof typeof manualForm.stats;
                             const val = manualForm.stats[key];
                             const mod = Math.floor((val - 10) / 2);
                             return (
                                 <div key={key} className="flex flex-col items-center bg-parchment-100 p-2 rounded border border-parchment-400">
                                     <label className="text-xs font-bold uppercase text-parchment-700">{key}</label>
                                     <div className="flex items-center gap-2 my-1">
                                         <button 
                                            onClick={() => handleStatChange(key, -1)}
                                            disabled={val <= MIN_STAT}
                                            className="w-6 h-6 flex items-center justify-center bg-parchment-300 hover:bg-parchment-400 rounded text-lg leading-none disabled:opacity-30"
                                         >
                                             -
                                         </button>
                                         <span className="font-title text-xl font-bold w-6 text-center">{val}</span>
                                         <button 
                                            onClick={() => handleStatChange(key, 1)}
                                            disabled={val >= MAX_STAT || pointsRemaining <= 0}
                                            className="w-6 h-6 flex items-center justify-center bg-parchment-300 hover:bg-parchment-400 rounded text-lg leading-none disabled:opacity-30"
                                         >
                                             +
                                         </button>
                                     </div>
                                     <div className="text-[10px] font-mono font-bold text-parchment-600">
                                         {mod >= 0 ? '+' : ''}{mod}
                                     </div>
                                 </div>
                             );
                        })}
                      </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase mb-1">Backstory</label>
                    <textarea 
                        className="w-full h-24 p-2 rounded bg-parchment-100 border border-parchment-400 resize-none"
                        value={manualForm.backstory}
                        onChange={e => setManualForm({...manualForm, backstory: e.target.value})}
                    />
                  </div>

                  {manualForm.avatarUrl && (
                      <div className="flex justify-center">
                          <img src={manualForm.avatarUrl} alt="Preview" className="w-24 h-24 rounded-full border-2 border-parchment-800 object-cover" />
                      </div>
                  )}
                  
                   <div className="flex gap-2">
                       <button
                            onClick={generatePortrait}
                            disabled={isGenerating || !manualForm.name}
                            className="flex-1 bg-parchment-300 text-parchment-900 border border-parchment-500 py-2 rounded font-bold hover:bg-parchment-400"
                        >
                            {manualForm.avatarUrl ? 'Regenerate Portrait' : 'Generate Portrait'}
                        </button>
                      <button 
                        onClick={handleCreateConfirm}
                        disabled={!manualForm.name || pointsRemaining < 0}
                        className="flex-[2] bg-green-900 text-parchment-100 py-2 rounded font-bold hover:bg-green-800 disabled:opacity-50 disabled:grayscale transition-all"
                      >
                        {pointsRemaining < 0 ? 'Too Many Points Used' : 'Add to Party'}
                      </button>
                   </div>
              </div>
            </div>

            <div className="flex flex-col justify-center items-center border-l border-parchment-300 pl-8">
               <div className="text-center space-y-4 sticky top-8">
                   <h3 className="font-title font-bold text-2xl border-b-2 border-parchment-800 pb-2 mb-4">Party Roster</h3>
                   <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 w-full min-w-[300px]">
                      {characters.map(c => (
                          <div key={c.id} className="bg-white/50 p-3 rounded border border-parchment-300 flex items-center gap-4 shadow-sm">
                              <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-800 border border-parchment-800 flex-shrink-0">
                                  <img src={c.avatarUrl || `https://picsum.photos/seed/${c.id}/100`} className="w-full h-full object-cover" />
                              </div>
                              <div className="text-left flex-1">
                                  <span className="font-bold block text-lg leading-none text-parchment-900">{c.name}</span>
                                  <span className="text-sm italic text-parchment-700">{c.race} {c.class}</span>
                              </div>
                          </div>
                      ))}
                      {characters.length === 0 && (
                          <div className="text-parchment-500 italic py-8 border-2 border-dashed border-parchment-300 rounded">
                              The tavern is empty. <br/> Create a hero!
                          </div>
                      )}
                   </div>

                   <div className="pt-8 border-t border-parchment-300 w-full">
                       <p className="text-lg mb-4">Ready to begin <strong>{campaign?.title}</strong>?</p>
                       <button 
                        onClick={startGame}
                        disabled={characters.length === 0}
                        className="w-full py-4 bg-parchment-900 text-parchment-100 font-title text-2xl font-bold rounded shadow-lg hover:bg-ink disabled:opacity-50 disabled:grayscale transition-all hover:scale-105"
                       >
                           Start Adventure
                       </button>
                   </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // GAME VIEW
  return (
    <div className="h-screen bg-parchment-900 flex overflow-hidden font-body text-slate-900">
      
      {/* Left Sidebar: Party & Stats */}
      <div className="w-80 bg-parchment-200 flex flex-col border-r-4 border-parchment-800 z-20 shadow-xl">
        <div className="p-4 bg-parchment-800 text-parchment-100 shadow-md z-10">
          <h1 className="font-title font-bold text-xl truncate">{campaign?.title}</h1>
          <div className="flex justify-between items-center mt-2">
             <span className="text-xs uppercase tracking-widest opacity-70">Turn {campaign?.turnCount}</span>
             <button onClick={saveGame} className="text-xs bg-parchment-100 text-parchment-900 px-2 py-1 rounded hover:bg-white">Save</button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]">
          {characters.map(char => (
            <CharacterCard 
              key={char.id} 
              character={char} 
              isActive={activePlayerId === char.id}
              onSelect={() => setActivePlayerId(char.id)}
              onStatCheck={handleStatCheck}
              onItemUse={handleItemUse}
            />
          ))}
        </div>

        {/* Dice Area */}
        <div className="p-4 border-t border-parchment-400 bg-parchment-300">
           <Dice onRoll={handleRoll} />
        </div>
      </div>

      {/* Main Content: Log & Input */}
      <div className="flex-1 flex flex-col min-w-0 bg-parchment-100 relative">
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/aged-paper.png')]"></div>
        
        {/* Game Log */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth z-0"
        >
          {campaign?.history.map(entry => (
            <div 
              key={entry.id} 
              className={`
                flex flex-col 
                ${entry.type === 'narrative' ? 'items-center text-center px-12' : 'items-start'}
                ${entry.type === 'system' ? 'items-center opacity-70' : ''}
              `}
            >
              <div className={`
                max-w-3xl rounded p-4 relative paper-shadow
                ${entry.type === 'narrative' ? 'bg-parchment-100 border-y-2 border-parchment-800 text-lg leading-relaxed font-serif' : ''}
                ${entry.type === 'action' ? 'bg-white/60 border border-parchment-300 ml-4 rounded-tl-none self-start' : ''}
                ${entry.type === 'roll' ? 'bg-slate-800 text-parchment-100 font-bold font-mono px-3 py-1 text-sm' : ''}
                ${entry.type === 'system' ? 'text-sm font-hand italic text-slate-600 bg-transparent shadow-none p-0' : ''}
              `}>
                {entry.author && entry.type !== 'system' && (
                  <div className="text-xs font-bold uppercase tracking-wider mb-1 opacity-50 text-left">
                    {entry.author}
                  </div>
                )}
                {entry.text}
              </div>
            </div>
          ))}
          
          {/* Pending Actions Display */}
          {turnActions.length > 0 && (
             <div className="max-w-3xl mx-auto mt-8 border-t-2 border-dashed border-parchment-400 pt-4 w-full">
                 <h4 className="font-title text-center text-parchment-500 mb-4">Pending Party Actions</h4>
                 <div className="grid gap-2">
                     {turnActions.map(act => {
                         const char = characters.find(c => c.id === act.playerId);
                         return (
                             <div key={act.playerId} className="flex justify-between items-center bg-yellow-50/50 p-2 rounded border border-yellow-200">
                                 <span className="font-bold text-sm">{char?.name}: <span className="font-normal italic">"{act.action}"</span></span>
                                 <button onClick={() => cancelAction(act.playerId)} className="text-red-500 hover:text-red-700 text-xs font-bold">CANCEL</button>
                             </div>
                         )
                     })}
                 </div>
             </div>
          )}

          {isGenerating && (
             <div className="text-center p-4 animate-pulse italic text-parchment-600">The Dungeon Master is plotting...</div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-parchment-200 border-t border-parchment-400 z-10 flex gap-4 items-end shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <div className="flex-1 relative">
             <div className="absolute -top-6 left-0 text-xs font-bold text-parchment-800">
                 Acting as: {characters.find(c => c.id === activePlayerId)?.name || 'Select a character'}
             </div>
             <textarea 
               value={currentInput}
               onChange={(e) => setCurrentInput(e.target.value)}
               placeholder={turnActions.find(a => a.playerId === activePlayerId) ? "Action submitted. Wait for party..." : "What do you want to do?"}
               disabled={!!turnActions.find(a => a.playerId === activePlayerId) || isGenerating}
               className="w-full h-20 bg-parchment-100 border-2 border-parchment-400 rounded p-3 font-hand text-xl focus:ring-2 focus:ring-parchment-800 focus:outline-none resize-none disabled:opacity-50 disabled:bg-gray-200"
               onKeyDown={(e) => {
                   if(e.key === 'Enter' && !e.shiftKey) {
                       e.preventDefault();
                       submitAction();
                   }
               }}
             />
          </div>
          
          <div className="flex flex-col gap-2">
             <button 
               onClick={() => submitAction()}
               disabled={!!turnActions.find(a => a.playerId === activePlayerId) || !currentInput.trim() || isGenerating}
               className="h-9 px-4 bg-parchment-800 text-parchment-100 rounded font-bold hover:bg-ink disabled:opacity-50 transition-colors"
             >
               Submit Action
             </button>
             
             <button 
               onClick={endTurn}
               disabled={turnActions.length === 0 || isGenerating}
               className={`
                 h-9 px-4 rounded font-bold transition-all border-2
                 ${turnActions.length === characters.length 
                    ? 'bg-green-800 text-white border-green-900 animate-pulse hover:animate-none' 
                    : 'bg-parchment-300 text-parchment-900 border-parchment-500'}
                 disabled:opacity-50 disabled:animate-none
               `}
             >
               {turnActions.length === characters.length ? "RESOLVE TURN" : `Wait (${turnActions.length}/${characters.length})`}
             </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar: Notes (Collapsible on mobile usually, keeping visible here) */}
      <div className="w-64 bg-parchment-100 border-l border-parchment-400 hidden lg:flex flex-col z-20 shadow-lg">
          <div className="p-3 bg-parchment-300 border-b border-parchment-400 font-title font-bold text-center text-parchment-900">
              Journal Notes
          </div>
          <textarea 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="flex-1 w-full bg-transparent p-4 font-hand text-lg resize-none focus:outline-none bg-[url('https://www.transparenttextures.com/patterns/lined-paper.png')]"
            placeholder="Keep track of quests, NPCs, and loot here..."
          />
      </div>

    </div>
  );
};

export default App;