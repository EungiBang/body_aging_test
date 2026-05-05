import React from 'react';

const Background: React.FC = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Deep space background */}
      <div className="absolute inset-0 bg-[#0f0c29]"></div>
      
      {/* Animated stars/particles */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-white rounded-full animate-pulse blur-[1px]"></div>
        <div className="absolute top-3/4 left-1/2 w-1 h-1 bg-blue-300 rounded-full animate-pulse delay-700 blur-[1px]"></div>
        <div className="absolute top-1/2 left-3/4 w-1.5 h-1.5 bg-purple-300 rounded-full animate-pulse delay-1000 blur-[1px]"></div>
        <div className="absolute top-1/3 left-2/3 w-1 h-1 bg-yellow-200 rounded-full animate-pulse delay-300 blur-[1px]"></div>
        <div className="absolute top-1/4 left-3/4 w-1 h-1 bg-white rounded-full animate-pulse delay-500 blur-[1px]"></div>
        <div className="absolute top-2/3 left-1/4 w-1.5 h-1.5 bg-blue-200 rounded-full animate-pulse delay-200 blur-[1px]"></div>
      </div>

      {/* Nebula/Glow effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-900/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse delay-1000"></div>
      
      {/* Grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle, #89fffd 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      ></div>
    </div>
  );
};

export default Background;
