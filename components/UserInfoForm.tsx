
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
    <div className="max-w-md mx-auto w-full py-16 px-6">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
        <h3 className="text-2xl font-bold text-slate-800 mb-6 text-center">측정 대상자 정보</h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">이름</label>
            <input 
              type="text" 
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="홍길동"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">성별</label>
            <div className="grid grid-cols-2 gap-3">
              {(['male', 'female'] as const).map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setFormData({...formData, gender: g})}
                  className={`py-3 rounded-xl border font-bold transition-all ${formData.gender === g ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-500'}`}
                >
                  {g === 'male' ? '남성' : '여성'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">만 나이 ({formData.age})</label>
            <input 
              type="range" 
              min="5" 
              max="100" 
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              value={formData.age}
              onChange={e => setFormData({...formData, age: parseInt(e.target.value)})}
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-black transition-all mt-4"
          >
            정보 저장 및 다음 단계
          </button>
        </form>
      </div>
    </div>
  );
};

export default UserInfoForm;
