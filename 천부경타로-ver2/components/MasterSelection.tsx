import React from 'react';
import { MASTERS } from '../data/masters';
import MasterIcon from './MasterIcons';

interface MasterSelectionProps {
  onMasterSelect: (masterId: string) => void;
}

const MasterSelection: React.FC<MasterSelectionProps> = ({ onMasterSelect }) => {
  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in text-center">
      <h2 className="text-3xl font-serif text-text-gold mb-2">해석할 마스터를 선택하세요</h2>
      <p className="text-gray-400 mb-10">누구의 지혜를 빌리시겠습니까?</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {MASTERS.map(master => (
          <button
            key={master.id}
            onClick={() => onMasterSelect(master.id)}
            className="group relative p-6 rounded-lg transition-all duration-300 transform hover:-translate-y-2 focus:-translate-y-2 outline-none overflow-hidden golden-master-card shadow-lg hover:shadow-amber-400/20 flex flex-col justify-center items-center text-center h-[300px]"
          >
            <div className="relative z-10">
              <div className="w-24 h-24 mx-auto mb-4 transition-all duration-300 group-hover:scale-110">
                 <MasterIcon masterId={master.id} />
              </div>
              <h3 className="text-3xl font-serif text-amber-950 font-bold" style={{textShadow: '0 1px 1px rgba(255,220,150,0.7)'}}>
                {master.name} 
                <span className="text-xl font-normal"> ({master.age})</span>
              </h3>
              <p className="text-md text-amber-900/80 mt-1">{master.title}</p>
            </div>
          </button>
        ))}
        <button
          onClick={() => onMasterSelect('random')}
           className="group relative p-6 rounded-lg transition-all duration-300 transform hover:-translate-y-2 focus:-translate-y-2 outline-none overflow-hidden golden-master-card shadow-lg hover:shadow-amber-400/20 flex flex-col justify-center items-center text-center h-[300px]"
        >
          <div className="relative z-10 flex flex-col justify-center items-center h-full">
             <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                <span className="text-7xl font-serif text-amber-950" style={{textShadow: '0 1px 2px rgba(255,220,150,0.7)'}} >?</span>
            </div>
            <h3 className="text-3xl font-serif text-amber-950 font-bold" style={{textShadow: '0 1px 1px rgba(255,220,150,0.7)'}}>랜덤</h3>
            <p className="text-md text-amber-900/80 mt-1">운명에 맡기기</p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default MasterSelection;