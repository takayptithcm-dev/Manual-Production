import React, { useState } from 'react';
import { X, Lock } from 'lucide-react';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PinModal: React.FC<PinModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const CORRECT_PIN = "0298"; // Default PIN

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === CORRECT_PIN) {
      setError(false);
      setPin('');
      onSuccess();
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Nhập Mật Khẩu</h2>
          <p className="text-sm text-slate-500 mt-1 text-center">
            Vui lòng nhập mã PIN để truy cập các tính năng quản lý
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(false);
              }}
              placeholder="Nhập mã PIN"
              className={`w-full px-4 py-3 text-center text-lg tracking-widest border rounded-md focus:outline-none focus:ring-2 ${
                error 
                  ? 'border-red-300 focus:ring-red-500' 
                  : 'border-slate-300 focus:ring-blue-500'
              }`}
              autoFocus
            />
            {error && (
              <p className="text-red-500 text-sm mt-2 text-center">
                Mã PIN không chính xác.
              </p>
            )}
          </div>
          
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-md transition-colors"
          >
            Xác nhận
          </button>
        </form>
      </div>
    </div>
  );
};
