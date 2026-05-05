import React from 'react';
import { VIDEO_BASE64 } from '../assets/videoData';

const VideoLoader: React.FC<{ message: string }> = ({ message }) => {
  const hasVideoData = VIDEO_BASE64 && !VIDEO_BASE64.startsWith('PLACEHOLDER');

  return (
    <div className="flex flex-col items-center justify-center space-y-4 text-center animate-fade-in">
      <div className="w-64 h-64 md:w-80 md:h-80 rounded-lg overflow-hidden shadow-lg border-2 border-yellow-300/30 bg-black flex items-center justify-center">
        {hasVideoData ? (
          <video
            // Assuming the video is mp4. Change the mime type if you use a different format.
            src={`data:video/mp4;base64,${VIDEO_BASE64}`}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
            aria-label="Shuffling tarot cards"
          />
        ) : (
          <div className="text-center p-4">
            <p className="text-yellow-200">영상을 준비 중입니다.</p>
            <p className="text-xs text-gray-400 mt-2">
              (개발자: <code className="bg-gray-700 px-1 rounded">assets/videoData.ts</code> 파일에<br/>
              base64 영상 문자열을 추가하세요.)
            </p>
          </div>
        )}
      </div>
      <p className="text-yellow-100 text-lg mt-4">{message}</p>
      {hasVideoData && <p className="text-xs text-gray-400">(연출된 영상입니다)</p>}
    </div>
  );
};

export default VideoLoader;
