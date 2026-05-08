import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User, Phone, Calendar, UserRound, Save, Loader2, CheckCircle2, Camera } from 'lucide-react';
import { updateUserProfile, getUserProfile } from '../lib/firebase';

interface ProfileSetupProps {
  onComplete: (data: { displayName: string; phoneNumber?: string; birthDate: string; gender: string }) => void;
  onCancel?: () => void;
  initialData?: { displayName: string; phoneNumber?: string; birthDate: string; gender: string };
}

export default function ProfileSetup({ onComplete, onCancel, initialData }: ProfileSetupProps) {
  const [formData, setFormData] = useState({
    displayName: initialData?.displayName || '',
    phoneNumber: initialData?.phoneNumber || '',
    birthDate: initialData?.birthDate || '',
    gender: initialData?.gender || 'none'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.displayName || !formData.birthDate || formData.gender === 'none') {
      alert("이름, 생년월일, 성별은 필수 입력 사항입니다.");
      return;
    }
    if (formData.birthDate.length < 10) {
      alert("생년월일을 숫자 8자리(예: 19741126)로 정확히 입력해주세요.");
      return;
    }
    onComplete(formData);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 border border-gray-100"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">분석 대상자 정보 입력</h2>
        <p className="text-gray-500 text-sm">보다 정확한 관상 분석을 위해 정보를 입력해주세요.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <User className="w-4 h-4 text-cyan-600" />
            이름 / 닉네임 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all outline-none"
            placeholder="홍길동"
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Phone className="w-4 h-4 text-cyan-600" />
            연락처 (선택)
          </label>
          <input
            type="tel"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all outline-none"
            placeholder="010-1234-5678"
            value={formData.phoneNumber}
            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-600" />
            생년월일 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            maxLength={10}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all outline-none"
            placeholder="예: 19741126"
            value={formData.birthDate}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '');
              let formatted = val;
              if (val.length > 4 && val.length <= 6) {
                formatted = `${val.slice(0, 4)}-${val.slice(4)}`;
              } else if (val.length > 6) {
                formatted = `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`;
              }
              setFormData({ ...formData, birthDate: formatted });
            }}
          />
          <p className="mt-1 text-[10px] text-gray-400 ml-1">숫자 8자리만 입력하시면 자동으로 형식에 맞게 입력됩니다.</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <UserRound className="w-4 h-4 text-cyan-600" />
            성별 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {['male', 'female', 'none'].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setFormData({ ...formData, gender: g })}
                className={`py-2 px-4 rounded-xl text-sm font-medium border transition-all ${
                  formData.gender === g
                    ? 'bg-cyan-600 text-white border-cyan-600 shadow-lg shadow-cyan-200'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-cyan-200'
                }`}
              >
                {g === 'male' ? '남성' : g === 'female' ? '여성' : '선택안함'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-2xl hover:bg-gray-200 transition-all active:scale-95"
            >
              취소
            </button>
          )}
          <button
            type="submit"
            className="flex-[2] py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-black shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" />
            분석 시작하기
          </button>
        </div>
      </form>
    </motion.div>
  );
}
