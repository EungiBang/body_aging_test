import { TarotMaster } from '../types';

// 표시용 필드만 클라에 둔다. 마스터 페르소나 프롬프트(창작 IP)는 서버(_master-personas.ts)로 이전됨.
// 클라는 masterId만 서버에 전달하고, 서버가 페르소나를 해석해 프롬프트를 조립한다(IP 은닉).
export const MASTERS: TarotMaster[] = [
  {
    id: 'masterKi',
    name: '마스터 키',
    age: '74세',
    title: '통찰의 현자',
    description: '깊은 지혜와 통찰로 삶의 본질을 꿰뚫어 봅니다.'
  },
  {
    id: 'cheonIn',
    name: '천인',
    age: '53세',
    title: '균형의 안내자',
    description: '현실과 이상의 균형을 찾아주는 실용적인 조언가입니다.'
  },
  {
    id: 'hwan',
    name: '빛',
    age: '120세',
    title: '고대의 신탁',
    description: '우주의 순리를 은유와 비유로 풀어내는 신비로운 현자입니다.'
  },
  {
    id: 'doRyeong',
    name: '남도령',
    age: '38세',
    title: '운명의 별',
    description: '스스로 운명을 개척하도록 용기를 북돋아 주는 열정적인 인물입니다.'
  },
  {
    id: 'ara',
    name: '아라',
    age: '18세',
    title: '영적인 아이',
    description: '순수한 영감과 직관으로 마음을 어루만지는 따뜻한 공감가입니다.'
  }
];
