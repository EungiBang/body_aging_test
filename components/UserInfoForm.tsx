
import React, { useState } from 'react';
import { UserInfo } from '../types';

interface UserInfoFormProps {
  onSubmit: (info: UserInfo) => void;
}

const UserInfoForm: React.FC<UserInfoFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = useState<UserInfo>({
    name: '',
    gender: 'male',
    age: 30,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return alert('이름을 입력해 주세요.');
    onSubmit(formData);
  };

  return (
    <div className="max-w-md mx-auto w-full py-16 px-6 animate-fadeIn">
      <div className="p-8 rounded-3xl" style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 className="text-2xl font-bold mb-6 text-center gradient-text">측정 대상자 정보</h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>이름</label>
            <input 
              type="text" 
              className="w-full px-4 py-3 rounded-xl outline-none transition-all"
              style={{ 
                background: 'rgba(255,255,255,0.05)', 
                border: '1px solid rgba(255,255,255,0.1)', 
                color: 'var(--text-primary)',
              }}
              placeholder="홍길동"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>성별</label>
            <div className="grid grid-cols-2 gap-3">
              {(['male', 'female'] as const).map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setFormData({...formData, gender: g})}
                  className="py-3 rounded-xl font-bold transition-all"
                  style={{ 
                    background: formData.gender === g ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.05)',
                    border: formData.gender === g ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    color: formData.gender === g ? 'white' : 'var(--text-secondary)',
                    boxShadow: formData.gender === g ? 'var(--glow-indigo)' : 'none',
                  }}
                >
                  {g === 'male' ? '남성' : '여성'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>
              만 나이 (<span className="gradient-text font-black">{formData.age}</span>)
            </label>
            <input 
              type="range" 
              min="5" 
              max="100" 
              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              style={{ background: 'rgba(255,255,255,0.1)' }}
              value={formData.age}
              onChange={e => setFormData({...formData, age: parseInt(e.target.value)})}
            />
          </div>

          <button 
            type="submit"
            className="w-full text-white font-bold py-4 rounded-xl shadow-lg transition-all mt-4"
            style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--glow-indigo)' }}
          >
            정보 저장 및 다음 단계 <i className="fas fa-chevron-right ml-2"></i>
          </button>
        </form>
      </div>
    </div>
  );
};

export default UserInfoForm;
