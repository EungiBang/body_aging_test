
import React from 'react';

const Loader: React.FC<{ message: string }> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-yellow-300"></div>
      <p className="text-yellow-100 text-lg">{message}</p>
    </div>
  );
};

export default Loader;
