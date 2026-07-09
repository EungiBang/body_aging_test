// 다국어(i18n) 번역 및 로케일 설정을 관리하는 설정 파일
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import translationKO from './locales/ko.json';
import translationEN from './locales/en.json';

const resources = {
  ko: {
    translation: translationKO
  },
  en: {
    translation: translationEN
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    // 미국 브랜치이므로 영어('en')를 기본 언어로 설정합니다.
    lng: 'en', 
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
