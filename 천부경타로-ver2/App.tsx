import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import StickShaker from './components/StickShaker';
import MasterSelection from './components/MasterSelection';
import CharacterCard from './components/CharacterCard';
import Background from './components/Background';
import { getInterpretation, getSpeech, generateMusic, generateImage, generateCharacterImage } from './services/geminiService';
import { CHEONBUGYEONG_CHARS } from './constants';
import type { CheonbugyeongCharacter } from './types';
import { MASTERS } from './data/masters';

type AppStep = 'FORM' | 'MASTER_SELECTION' | 'SHUFFLING' | 'INTERPRETING' | 'RESULT' | 'ERROR';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// --- Audio Helper Functions ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
// --- End Audio Helper Functions ---


const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('FORM');
  const [name, setName] = useState('');
  const [age, setAge] = useState('25');
  const [gender, setGender] = useState('여성');
  const [concern, setConcern] = useState('');
  const [master, setMaster] = useState('');
  const [selectedCharacters, setSelectedCharacters] = useState<{
    past: CheonbugyeongCharacter | null;
    present: CheonbugyeongCharacter | null;
    future: CheonbugyeongCharacter | null;
  }>({ past: null, present: null, future: null });
  const [interpretation, setInterpretation] = useState('');
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const recognitionRef = useRef<any>(null);
  
  // TTS State
  const [isTtsLoading, setIsTtsLoading] = useState(false);
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  
  // Music State
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [isMusicLoading, setIsMusicLoading] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);


  useEffect(() => {
    const checkApiKey = async () => {
      if ((window as any).aistudio && await (window as any).aistudio.hasSelectedApiKey()) {
        setHasApiKey(true);
      }
    };
    checkApiKey();

    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      return; // Speech recognition not supported
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = false;
    recognitionInstance.lang = 'ko-KR';
    recognitionInstance.interimResults = false;
    recognitionInstance.maxAlternatives = 1;

    recognitionInstance.onstart = () => {
      setIsRecording(true);
      setError('');
    };

    recognitionInstance.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      setConcern(prev => (prev ? prev.trim() + ' ' : '') + transcript.trim());
    };

    recognitionInstance.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('마이크 접근 권한이 필요합니다. 권한을 허용해주세요.');
      } else {
        setError(`음성 인식 오류: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognitionInstance.onend = () => {
      setIsRecording(false);
    };
    
    recognitionRef.current = recognitionInstance;
    
    // Cleanup audio context on component unmount
    return () => {
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
    };

  }, []);

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      setError('음성 인식을 지원하지 않는 브라우저입니다.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Could not start recognition", e);
        setError("음성 인식을 시작할 수 없습니다. 이미 실행 중일 수 있습니다.");
        setIsRecording(false);
      }
    }
  };

  const handleOpenSelectKey = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const shuffleAndSelect = useCallback(() => {
    const shuffled = [...CHEONBUGYEONG_CHARS].sort(() => 0.5 - Math.random());
    return { past: shuffled[0], present: shuffled[1], future: shuffled[2] };
  }, []);
  
  const handleProceedToMasterSelection = () => {
     if (!name.trim() || !concern.trim()) {
      setError('이름과 고민을 모두 입력해주세요.');
      return;
    }
    setError('');
    setStep('MASTER_SELECTION');
  }

  const handleSelectMasterAndInterpret = async (masterId: string) => {
    let finalMasterId = masterId;
    if (masterId === 'random') {
      const mastersWithoutRandom = MASTERS.filter(m => m.id !== 'random');
      finalMasterId = mastersWithoutRandom[Math.floor(Math.random() * mastersWithoutRandom.length)].id;
    }
    setMaster(finalMasterId);
    setStep('SHUFFLING');
    
    const { past, present, future } = shuffleAndSelect();
    setSelectedCharacters({ past, present, future });

    // Start image generation in background
    const generateImages = async () => {
      if (hasApiKey) {
        try {
          const [pastImg, presentImg, futureImg] = await Promise.all([
            generateCharacterImage(past),
            generateCharacterImage(present),
            generateCharacterImage(future)
          ]);
          setSelectedCharacters({
            past: { ...past, imageUrl: pastImg || undefined },
            present: { ...present, imageUrl: presentImg || undefined },
            future: { ...future, imageUrl: futureImg || undefined }
          });
        } catch (err) {
          console.error("Image generation error:", err);
        }
      }
    };
    generateImages();

    setTimeout(async () => {
      setStep('INTERPRETING');
      const interpretationStartTime = Date.now();
      try {
        const result = await getInterpretation(concern, name, age, gender, past, present, future, finalMasterId);
        const elapsedTime = Date.now() - interpretationStartTime;
        const remainingTime = Math.max(0, 5000 - elapsedTime);
        
        setTimeout(() => {
            setInterpretation(result);
            setStep('RESULT');
        }, remainingTime);

      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        setStep('ERROR');
      }
    }, 4000); 
  };
  
  const stopTts = () => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }
    setIsTtsPlaying(false);
    setIsTtsLoading(false);
  }

  const handleReset = () => {
    stopTts();
    stopMusic();
    setMusicUrl(null);
    setStep('FORM');
    // Do not reset name, age, gender for user convenience
    setConcern('');
    setMaster('');
    setSelectedCharacters({ past: null, present: null, future: null });
    setInterpretation('');
    setError('');
  };
  
  const formatResultForSharing = () => {
    const masterName = MASTERS.find(m => m.id === master)?.name || '천부경 마스터';
    const title = "천부경 타로 해석 결과";
    const userInfo = `이름: ${name}\n고민: ${concern}\n해석자: ${masterName}`;
    const chars = `
* 과거: ${selectedCharacters.past?.char} (${selectedCharacters.past?.reading})
* 현재: ${selectedCharacters.present?.char} (${selectedCharacters.present?.reading})
* 미래: ${selectedCharacters.future?.char} (${selectedCharacters.future?.reading})
    `;
    const cleanedInterpretation = interpretation.replace(/###\s/g, '\n**').replace(/$/,'**');
    return `${title}\n\n${userInfo}\n\n${chars}\n\n${cleanedInterpretation}`;
  };

  const handleShare = async () => {
    const shareText = formatResultForSharing();
    const shareData = {
      title: '천부경 타로 해석 결과',
      text: shareText,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        throw new Error('Web Share API not supported.');
      }
    } catch (err) {
      navigator.clipboard.writeText(shareText).then(() => {
        alert('결과가 클립보드에 복사되었습니다. 친구에게 붙여넣기하여 공유해보세요.');
      }).catch(clipErr => {
        console.error('Failed to copy to clipboard:', clipErr);
        alert('결과를 복사하는 데 실패했습니다.');
      });
    }
  };
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleTtsPlayback = async () => {
    if (isTtsPlaying || isTtsLoading) {
      stopTts();
      return;
    }
    
    if (isMusicPlaying) {
      stopMusic();
    }

    setIsTtsLoading(true);
    setError('');

    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const audioCtx = audioContextRef.current;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const cleanText = interpretation.replace(/###\s*.*?\n/g, '\n').replace(/[\*`#_]/g, '').trim();
      const base64Audio = await getSpeech(cleanText);

      if (!base64Audio) {
        throw new Error("오디오 데이터를 받지 못했습니다.");
      }

      const audioBuffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      
      source.onended = () => {
        setIsTtsPlaying(false);
        audioSourceRef.current = null;
      };
      
      source.start(0);
      audioSourceRef.current = source;
      setIsTtsPlaying(true);
    } catch (err) {
      console.error("TTS Error:", err);
      setError(err instanceof Error ? err.message : '음성 변환 중 오류가 발생했습니다.');
      setIsTtsPlaying(false);
    } finally {
      setIsTtsLoading(false);
    }
  };


  const stopMusic = () => {
    if (musicAudioRef.current) {
      musicAudioRef.current.pause();
      musicAudioRef.current.currentTime = 0;
    }
    setIsMusicPlaying(false);
  };

  const handleMusicPlayback = async () => {
    if (isMusicPlaying) {
      stopMusic();
      return;
    }
    
    if (isTtsPlaying) {
      stopTts();
    }

    if (musicUrl) {
      if (!musicAudioRef.current) {
        musicAudioRef.current = new Audio(musicUrl);
        musicAudioRef.current.onended = () => setIsMusicPlaying(false);
      }
      musicAudioRef.current.play();
      setIsMusicPlaying(true);
      return;
    }

    setIsMusicLoading(true);
    setError('');

    try {
      const result = await generateMusic("신비롭고 몽환적이며 마음이 편안해지는 힐링 명상 음악. 동양적인 분위기가 가미된 잔잔한 선율.");
      if (result) {
        setMusicUrl(result.audioUrl);
        const audio = new Audio(result.audioUrl);
        musicAudioRef.current = audio;
        audio.onended = () => setIsMusicPlaying(false);
        audio.play();
        setIsMusicPlaying(true);
      } else {
        throw new Error("음악 생성에 실패했습니다.");
      }
    } catch (err) {
      console.error("Music Error:", err);
      setError(err instanceof Error ? err.message : '음악 생성 중 오류가 발생했습니다.');
    } finally {
      setIsMusicLoading(false);
    }
  };


  const handleReimagine = async () => {
    if (!customPrompt.trim()) return;
    setIsImageLoading(true);
    setError('');
    try {
      const newImg = await generateImage(customPrompt);
      if (newImg) {
        // Update the future card with the new image as a "re-imagined" future
        setSelectedCharacters(prev => ({
          ...prev,
          future: prev.future ? { ...prev.future, imageUrl: newImg } : null
        }));
        setCustomPrompt('');
      } else {
        throw new Error("이미지 생성에 실패했습니다.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setIsImageLoading(false);
    }
  };


  const renderContent = () => {
    if (!hasApiKey) {
      return (
        <div className="glass-card text-center animate-fade-in max-w-md mx-auto">
          <h2 className="title-main mb-4">API 키 설정 필요</h2>
          <p className="text-text-light/80 mb-6">
            이미지 생성을 위해 Gemini API 키 설정이 필요합니다.<br/>
            아래 버튼을 눌러 API 키를 선택해주세요.
          </p>
          <button onClick={handleOpenSelectKey} className="primary-button text-lg w-full">
            API 키 선택하기
          </button>
          <p className="mt-4 text-xs text-gray-400">
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline">
              결제 및 API 키 관련 문서 보기
            </a>
          </p>
        </div>
      );
    }

    switch (step) {
      case 'FORM':
      case 'ERROR':
        return (
          <>
            <div className="text-center mb-8">
                <h1 className="font-serif title-main">
                    천부경 타로
                </h1>
                <p className="title-sub">
                    Cheonbugyeong Tarot
                </p>
            </div>
            <div className="glass-card animate-fade-in">
              <div className="flex justify-between items-center mb-4">
                  <p className="text-text-light/80 text-sm" style={{ whiteSpace: 'pre-line' }}>
                    {`이곳에 당신의 고민을 적어주시면, 우주의 법칙과 에너지로 만들어진
천부경 81자가 우주의 지혜와 에너지를 전해드립니다.`}
                  </p>
                   <button 
                    onClick={handleMicClick}
                    className={`w-10 h-10 flex-shrink-0 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-cyan-300 ${isRecording ? 'recording-pulse' : ''}`}
                    aria-label={isRecording ? '음성 입력 중지' : '음성으로 고민 입력하기'}
                   >
                     {isRecording ? (
                       <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
                     ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                     )}
                   </button>
              </div>

              <div className="w-full">
                  <textarea
                      id="concern"
                      name="concern"
                      value={concern}
                      onChange={(e) => setConcern(e.target.value)}
                      placeholder={isRecording ? '듣고 있습니다...' : '당신의 고민을 여기에 적어주세요...'}
                  />
                  <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" className="text-center" />
                      <select value={age} onChange={(e) => setAge(e.target.value)} className="text-center">
                          {Array.from({ length: 100 }, (_, i) => i + 10).map(num => <option key={num} value={num}>{num}세</option>)}
                      </select>
                      <select value={gender} onChange={(e) => setGender(e.target.value)} className="text-center">
                          <option>여성</option>
                          <option>남성</option>
                      </select>
                  </div>
              </div>
              
              {error && <p className="text-center text-red-400 my-4 text-sm">{error}</p>}
            </div>
            <div className="text-center mt-6">
                <button onClick={handleProceedToMasterSelection} disabled={!name.trim() || !concern.trim()} className="p-4 rounded-md primary-button text-lg">
                    우주의 지혜를 구합니다
                </button>
            </div>
          </>
        );
      case 'MASTER_SELECTION':
        return <MasterSelection 
                 onMasterSelect={handleSelectMasterAndInterpret}
               />;
      case 'SHUFFLING':
      case 'INTERPRETING':
          return <StickShaker mode={step} />;
      case 'RESULT':
        return (
           <div className="w-full max-w-4xl mx-auto animate-fade-in">
              <div className="text-center mb-8">
                <p className="text-gray-400">{name}님의 질문:</p>
                <h2 className="text-2xl text-text-gold font-serif">"{concern}"</h2>
              </div>

              <div className="text-center mb-6">
                <p className="text-lg font-serif text-gray-300/90 tracking-wide">
                  당신이 고민을 풀어줄 우주의 천부경 3글자
                </p>
              </div>
              
              <div className="flex flex-row items-center justify-center gap-2 md:gap-4 pb-4">
                {selectedCharacters.past && <CharacterCard character={selectedCharacters.past} label="과거" />}
                {selectedCharacters.present && <CharacterCard character={selectedCharacters.present} label="현재" />}
                {selectedCharacters.future && <CharacterCard character={selectedCharacters.future} label="미래" />}
              </div>

              <div className="result-interpretation-card mt-12">
                <div className="prose-dark max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{interpretation}</ReactMarkdown>
                </div>
              </div>

              {/* Re-imagine Section */}
              <div className="glass-card mt-12 animate-fade-in no-print">
                <h3 className="text-xl text-text-gold font-serif mb-4">미래를 다시 그려보기</h3>
                <p className="text-sm text-gray-400 mb-4">
                  원하는 미래의 모습을 설명해주세요. AI가 당신의 소망을 담은 새로운 이미지를 생성합니다.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input 
                    type="text" 
                    value={customPrompt} 
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="예: 평화로운 숲속에서 명상하는 모습, 황금빛 빛이 쏟아지는 풍경..."
                    className="flex-grow"
                  />
                  <button 
                    onClick={handleReimagine}
                    disabled={isImageLoading || !customPrompt.trim()}
                    className="primary-button whitespace-nowrap"
                  >
                    {isImageLoading ? '생성 중...' : '이미지 생성'}
                  </button>
                </div>
              </div>
              
               <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 no-print">
                    <button onClick={handleReset} className="w-full sm:w-auto px-6 py-3 rounded-md primary-button text-lg">새로운 지혜 구하기</button>
                    <button 
                      onClick={handleTtsPlayback} 
                      disabled={isTtsLoading}
                      className="w-full sm:w-auto px-6 py-3 rounded-md secondary-button text-lg flex items-center justify-center gap-2"
                      aria-label={isTtsPlaying ? "해석 듣기 중지" : "해석 듣기"}
                    >
                      {isTtsLoading ? (
                        <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : isTtsPlaying ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.8 3.2a1 1 0 0 0-1.6 1.2A8 8 0 0 1 20 12a8 8 0 0 1-2.8 6.6 1 1 0 1 0 1.6 1.2A10 10 0 0 0 22 12a10 10 0 0 0-3.2-8.8Z"/><path d="M15.2 6.8a1 1 0 0 0-1.6 1.2A4 4 0 0 1 16 12a4 4 0 0 1-2.4 4 1 1 0 1 0 1.6 1.2A6 6 0 0 0 18 12a6 6 0 0 0-2.8-5.2Z"/><path d="M4 9h3L11 5v14l-4-4H4a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2Z"/></svg>
                      )}
                      <span>{isTtsLoading ? '준비 중...' : isTtsPlaying ? '듣기 중지' : '해석 듣기'}</span>
                    </button>
                    <button 
                      onClick={handleMusicPlayback} 
                      disabled={isMusicLoading}
                      className="w-full sm:w-auto px-6 py-3 rounded-md secondary-button text-lg flex items-center justify-center gap-2"
                      aria-label={isMusicPlaying ? "힐링 음악 중지" : "힐링 음악 듣기"}
                    >
                      {isMusicLoading ? (
                        <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : isMusicPlaying ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                      )}
                      <span>{isMusicLoading ? '생성 중...' : isMusicPlaying ? '음악 중지' : '힐링 음악'}</span>
                    </button>
                    <button onClick={handleShare} className="w-full sm:w-auto px-6 py-3 rounded-md secondary-button text-lg">결과 공유하기</button>
                    <button onClick={handlePrint} className="w-full sm:w-auto px-6 py-3 rounded-md secondary-button text-lg">결과 인쇄하기</button>
                </div>
                {error && <p className="text-center text-red-400 my-4 text-sm">{error}</p>}
            </div>
        );
      default: return null;
    }
  };

  return (
    <main className="min-h-screen font-sans flex items-center justify-center p-4 md:p-8">
        <Background />
        <div className="w-full max-w-2xl">
         {renderContent()}
        </div>
    </main>
  );
};

export default App;