import React from 'react';

const StickAnimation: React.FC<{ message: string }> = ({ message }) => {
  const sticks = Array.from({ length: 81 });

  return (
    <div className="flex flex-col items-center justify-center space-y-8 text-center animate-fade-in">
      <div 
        className="relative w-48 h-64 border-4 border-amber-800 bg-amber-900/50 rounded-lg flex items-center justify-center overflow-hidden shadow-inner"
        style={{ perspective: '1000px' }}
      >
        <div 
          className="relative w-full h-full"
          style={{ transformStyle: 'preserve-3d', transform: 'rotateX(10deg)' }}
        >
          {sticks.map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-40 bg-gradient-to-b from-amber-500 to-amber-700 rounded-full shadow-md animate-bob"
              style={{
                '--base-transform': `rotateZ(${Math.random() * 40 - 20}deg) translateX(${Math.random() * 80 - 40}px) rotateY(${Math.random() * 20 - 10}deg)`,
                '--y-offset': `${-20 - Math.random() * 10}px`,
                bottom: '0',
                left: '50%',
                marginLeft: '-0.25rem',
                transformOrigin: 'bottom center',
                transform: 'var(--base-transform)',
                animationDuration: `${1.5 + Math.random()}s`,
                animationDelay: `${Math.random()}s`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
      <p className="text-yellow-100 text-lg mt-4">{message}</p>
      <style>{`
        @keyframes bob {
          50% {
            transform: var(--base-transform) translateY(var(--y-offset));
          }
        }
        .animate-bob {
          animation-name: bob;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
          animation-direction: alternate;
        }
      `}</style>
    </div>
  );
};

export default StickAnimation;
