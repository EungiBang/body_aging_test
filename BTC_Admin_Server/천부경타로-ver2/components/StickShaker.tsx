import React from 'react';

interface StickShakerProps {
  mode: 'SHUFFLING' | 'INTERPRETING';
}

const StickShaker: React.FC<StickShakerProps> = ({ mode }) => {
  const sticks = Array.from({ length: 81 });
  
  const mainMessage = "우주의 원리와 에너지가 담긴 천부경의 81자 중에서 3개를 뽑아서 당신의 고민을 풀어 드립니다.";
  const subMessage = mode === 'SHUFFLING' 
    ? "운명의 막대를 섞고 있습니다..." 
    : "선택된 지혜를 해석하고 있습니다...";

  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center animate-fade-in">
       {/* Text is visually on top */}
      <div className="relative z-20 mb-8 max-w-md">
        <p className="text-lg font-serif text-text-gold">{mainMessage}</p>
        <p className={`text-sm text-text-light/70 mt-2 h-5 ${mode === 'INTERPRETING' ? 'interpreting-message' : ''}`}>{subMessage}</p>
      </div>

      {/* Animation is visually at the bottom */}
      <div className="relative w-[300px] h-[400px]" style={{ perspective: '1000px' }}>
        {/* Particles and Smoke */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className="particle" style={{
              '--x': `${Math.random() * 100}%`,
              '--y': `${Math.random() * 100}%`,
              '--d': `${Math.random() * 5 + 3}s`,
              '--s': `${Math.random() * 0.8 + 0.5}px`
            } as React.CSSProperties} />
          ))}
          <div className="smoke smoke1"></div>
          <div className="smoke smoke2"></div>
        </div>
        
        {/* Ethereal energy motes for interpretation */}
        {mode === 'INTERPRETING' && (
          <div className="energy-motes">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="mote"
                style={{
                  '--delay': `${Math.random() * 5}s`,
                  '--duration': `${4 + Math.random() * 3}s`,
                  '--x-start': `${20 + Math.random() * 60}%`,
                  '--x-end-offset': `${(Math.random() - 0.5) * 100}px`,
                  '--scale-end': `${0.2 + Math.random() * 0.5}`
                } as React.CSSProperties}
              />
            ))}
          </div>
        )}

        {/* Container */}
        <div className="container">
          {/* Sticks */}
          <div className={`sticks-wrapper ${mode === 'SHUFFLING' ? 'is-shuffling' : 'is-interpreting'}`}>
            {sticks.map((_, i) => (
              <div
                key={i}
                className="stick"
                style={{
                  '--r': `${Math.random() * 30 - 15}deg`,
                  '--x': `${Math.random() * 60 - 30}px`,
                  '--delay': `${Math.random() * 1.5}s`,
                  '--char-code': `${0x5929}`
                } as React.CSSProperties}
              />
            ))}
          </div>
        </div>
      </div>
      
      <style>{`
        .container {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 200px;
          height: 280px;
          background: linear-gradient(160deg, #1e5a4d, #2a7c6a 50%, #1a4e42);
          border-radius: 20px 20px 10px 10px;
          border-top: 5px solid #11322a;
          border-bottom: 10px solid #153d34;
          box-shadow: inset 0 5px 15px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);
          display: flex;
          justify-content: center;
          transform-style: preserve-3d;
          z-index: 10;
        }
        .container::before {
          content: '天符經';
          position: absolute;
          bottom: 30px;
          font-family: 'Gowun Batang', serif;
          font-size: 20px;
          color: #f0c370;
          text-shadow: 0 0 10px #f0c370, 0 0 20px #f0c370;
          opacity: 0.7;
        }

        .sticks-wrapper {
          position: absolute;
          top: 0;
          width: 100%;
          height: 200px;
          transform: translateY(-10px) rotateX(-10deg);
          transform-style: preserve-3d;
        }

        .stick {
          position: absolute;
          top: 0;
          left: 50%;
          margin-left: -5px;
          width: 10px;
          height: 180px;
          background: linear-gradient(#b4862c, #f0c370, #b4862c);
          border-radius: 5px;
          transform-origin: top center;
          transition: transform 0.5s ease-out, opacity 0.5s ease-out;
        }
        .stick::before {
          content: '疆';
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 8px;
          color: #8a621c;
        }

        /* SHUFFLING ANIMATION */
        .is-shuffling .stick {
            animation: shuffle-tremendously 1.5s infinite ease-in-out;
            animation-delay: var(--delay);
        }
        @keyframes shuffle-tremendously {
            0%, 100% {
                transform: rotateZ(calc(var(--r) / 2)) translateY(0);
            }
            50% {
                transform: rotateZ(calc(var(--r) * -1)) translateY(40px) translateX(var(--x));
            }
        }

        /* INTERPRETING (SELECTION) ANIMATION */
        .is-interpreting .stick {
            animation: none;
            opacity: 0.3;
            transform: rotateZ(0) translateY(0) translateX(0);
        }

        .is-interpreting .stick:nth-child(1),
        .is-interpreting .stick:nth-child(2),
        .is-interpreting .stick:nth-child(3) {
            opacity: 1;
            animation: rise-up-selected 2s forwards cubic-bezier(0.22, 1, 0.36, 1), pulse-glow 2.5s infinite ease-in-out;
            box-shadow: 0 0 15px 3px #f0c370;
            z-index: 20;
        }
        
        .is-interpreting .stick:nth-child(1) { animation-delay: 0.2s, 2.2s; }
        .is-interpreting .stick:nth-child(2) { animation-delay: 0.5s, 2.5s; }
        .is-interpreting .stick:nth-child(3) { animation-delay: 0.35s, 2.35s; }

        .interpreting-message {
            animation: pulse-opacity 2s infinite ease-in-out;
        }

        @keyframes rise-up-selected {
            from {
                transform: translateY(0);
            }
            to {
                transform: translateY(-150px);
            }
        }
        
        @keyframes pulse-glow {
            0%, 100% {
                box-shadow: 0 0 15px 3px #f0c370;
                filter: brightness(1.1);
            }
            50% {
                box-shadow: 0 0 30px 10px #f0c370;
                filter: brightness(1.4);
            }
        }

        @keyframes pulse-opacity {
            50% {
                opacity: 1;
            }
        }

        /* Ethereal motes animation */
        .energy-motes {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 15;
          overflow: hidden;
        }

        .mote {
          position: absolute;
          bottom: 40px;
          left: var(--x-start);
          width: 5px;
          height: 5px;
          background: #f0c370;
          border-radius: 50%;
          box-shadow: 0 0 12px 3px #f0c370;
          filter: blur(1.5px);
          animation: rise-mote var(--duration) infinite ease-out;
          animation-delay: var(--delay);
        }

        @keyframes rise-mote {
          from {
            transform: translateY(0);
            opacity: 0.9;
          }
          to {
            transform: translateY(-400px) translateX(var(--x-end-offset)) scale(var(--scale-end));
            opacity: 0;
          }
        }


        /* Background Effects */
        .particle {
          position: absolute;
          top: var(--y);
          left: var(--x);
          width: var(--s);
          height: var(--s);
          background: #f0c370;
          border-radius: 50%;
          filter: blur(1px);
          animation: particle-anim var(--d) infinite linear;
          animation-delay: calc(var(--d) * -1);
        }
        @keyframes particle-anim {
          from { transform: translateY(0) scale(1); opacity: 0.7; }
          to { transform: translateY(-100px) scale(0.5); opacity: 0; }
        }

        .smoke {
          position: absolute;
          left: 50%;
          bottom: -50px;
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(240, 195, 112, 0.1) 0%, rgba(240, 195, 112, 0) 60%);
          border-radius: 50%;
          animation: smoke-anim 10s infinite linear;
        }
        .smoke1 { 
          transform: translateX(-50%) scale(1.2); 
          opacity: 0.5;
        }
        .smoke2 { 
          transform: translateX(-60%) scale(0.8);
          animation-direction: reverse;
          animation-duration: 12s;
          opacity: 0.3;
        }
        @keyframes smoke-anim {
          from { transform: translateX(-50%) translateY(0) rotate(0deg); }
          to { transform: translateX(-50%) translateY(-150px) rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default StickShaker;