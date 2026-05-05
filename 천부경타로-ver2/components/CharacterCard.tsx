import React from 'react';
import type { CheonbugyeongCharacter } from '../types';

interface CharacterCardProps {
  character: CheonbugyeongCharacter;
  label: string;
}

const CharacterCard: React.FC<CharacterCardProps> = ({ character, label }) => {
  return (
    <div 
      className="relative w-28 h-[300px] flex flex-col items-center justify-between text-center transition-all duration-300 ease-in-out transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-yellow-400/50 animate-fade-in rounded-lg overflow-hidden flex-shrink-0 cursor-pointer group border border-amber-700/50"
      style={{
        background: 'linear-gradient(to bottom, #f0c370, #d4af37, #b4862c 90%)',
        boxShadow: 'inset 0 2px 3px rgba(255, 255, 255, 0.2), inset 0 -2px 3px rgba(0, 0, 0, 0.2), 0 5px 15px rgba(0,0,0,0.3)',
      }}
    >
      
      {/* Top Cap */}
      <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-b from-amber-700 to-amber-800 shadow-inner"></div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-col items-center justify-between h-full text-black w-full pt-6 pb-6">
        
        {/* Background Image if available */}
        {character.imageUrl && (
          <div className="absolute inset-0 z-0 opacity-80">
            <img 
              src={character.imageUrl} 
              alt={character.char} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-amber-200/30 via-transparent to-amber-900/60"></div>
          </div>
        )}

        {/* Top section: Label */}
        <div className="relative z-10 flex-shrink-0">
            <p className="font-serif text-amber-950 font-bold text-base tracking-wider" style={{ textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}>
              {label}
            </p>
        </div>
        
        {/* Middle section: Character info */}
        <div className="relative z-10 flex flex-col items-center justify-center flex-grow my-2">
            {/* Character (Hanja) */}
            <p className="text-5xl font-serif" style={{ 
              color: character.imageUrl ? '#fff' : '#5a451a',
              textShadow: character.imageUrl 
                ? '0 0 10px rgba(0,0,0,0.8), 2px 2px 4px rgba(0,0,0,0.5)' 
                : '0 2px 2px rgba(255,220,150,0.6), 0 -1px 1px rgba(0,0,0,0.2)'
            }}>
              {character.char}
            </p>
            {/* Reading (Korean) */}
            <p className="text-lg font-serif mt-1" style={{ 
              color: character.imageUrl ? '#fff' : '#6a501a', 
              textShadow: character.imageUrl ? '0 1px 3px rgba(0,0,0,0.8)' : '0 1px 1px rgba(255,255,255,0.3)' 
            }}>
              {character.reading}
            </p>
        </div>

        {/* Bottom section: Meaning */}
        <div className="relative z-10 flex-shrink-0 bg-white/20 backdrop-blur-sm px-2 py-1 rounded">
            <p className="text-xs font-bold leading-tight" style={{ color: character.imageUrl ? '#fff' : '#6a501a', textShadow: character.imageUrl ? '0 1px 2px rgba(0,0,0,0.8)' : '0 1px 1px rgba(255,255,255,0.2)' }}>
              {character.meaning}
            </p>
        </div>
      </div>

      {/* Bottom Cap */}
      <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-amber-700 to-amber-800 shadow-inner"></div>

       {/* Glossy shine effect */}
      <div 
        className="absolute top-0 left-[-75%] w-[250%] h-full opacity-10 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none -rotate-45"
        style={{
          background: 'linear-gradient(to right, transparent 0%, white 50%, transparent 100%)'
        }}
      />
    </div>
  );
};

export default CharacterCard;