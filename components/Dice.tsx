import React, { useState } from 'react';

interface DiceProps {
  onRoll: (total: number, rolls: number[]) => void;
}

const Dice: React.FC<DiceProps> = ({ onRoll }) => {
  const [isRolling, setIsRolling] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  const roll = () => {
    setIsRolling(true);
    setResult(null);
    
    // Simulate animation time
    setTimeout(() => {
      const val = Math.floor(Math.random() * 20) + 1;
      setResult(val);
      setIsRolling(false);
      onRoll(val, [val]);
    }, 600);
  };

  return (
    <div className="flex flex-col items-center p-4 border-2 border-parchment-800/20 rounded bg-parchment-200/50">
      <h3 className="font-title text-sm font-bold mb-2 text-parchment-900">D20 Roller</h3>
      
      <button 
        onClick={roll}
        disabled={isRolling}
        className={`
            relative w-16 h-16 flex items-center justify-center 
            bg-parchment-800 text-parchment-100 font-bold text-2xl 
            rounded-xl shadow-lg transition-all duration-300
            ${isRolling ? 'animate-spin' : 'hover:scale-110 active:scale-95'}
        `}
        style={{
             clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)"
        }}
      >
        {result ?? '?'}
      </button>
      
      <div className="mt-2 text-xs font-hand text-parchment-900 font-bold">
        {isRolling ? 'Rolling...' : result ? `Rolled: ${result}` : 'Click to Roll'}
      </div>
    </div>
  );
};

export default Dice;