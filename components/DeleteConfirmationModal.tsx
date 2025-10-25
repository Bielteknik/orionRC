import React, { useState, useEffect } from 'react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
}

const CORRECT_PASSWORD = "Ejder.2578";

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (password === CORRECT_PASSWORD) {
      onConfirm();
      onClose();
    } else {
      setError('Geçersiz şifre. Lütfen tekrar deneyin.');
      setPassword('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        handleConfirm();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-primary rounded-lg shadow-xl w-full max-w-md transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-danger">{title}</h2>
          <button onClick={onClose} className="p-2 text-muted hover:bg-gray-100 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <main className="p-6 space-y-4">
          <p className="text-gray-600">{message}</p>
          <div>
            <label htmlFor="delete-password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Onay Şifresi
            </label>
            <input
              id="delete-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              className={`w-full bg-secondary border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${
                error ? 'border-danger focus:ring-danger' : 'border-gray-300 focus:ring-accent'
              }`}
              autoFocus
            />
            {error && <p className="text-xs text-danger mt-1.5">{error}</p>}
          </div>
        </main>
        <footer className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-primary border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-100 font-semibold"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 bg-danger text-white rounded-lg hover:bg-red-700 font-semibold"
          >
            Sil
          </button>
        </footer>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
