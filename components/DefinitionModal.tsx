import React, { useState, useEffect } from 'react';

interface DefinitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  initialValue?: string;
  title: string;
}

const DefinitionModal: React.FC<DefinitionModalProps> = ({ isOpen, onClose, onSave, initialValue = '', title }) => {
  const [name, setName] = useState(initialValue);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(initialValue);
      setError('');
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) {
      setError('İsim alanı boş bırakılamaz.');
      return;
    }
    onSave(name);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
      <div className="bg-primary rounded-lg shadow-xl w-full max-w-md">
        <header className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-2 text-muted hover:bg-gray-100 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>
        <main className="p-6">
          {error && <div className="bg-danger/10 text-danger text-sm font-medium p-3 rounded-md mb-4">{error}</div>}
          <div>
            <label htmlFor="definition-name" className="block text-sm font-medium text-gray-700 mb-1.5">Tanım Adı *</label>
            <input
              id="definition-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-secondary border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </main>
        <footer className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 bg-primary border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-100 font-semibold">
            İptal
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-orange-600 font-semibold">
            Kaydet
          </button>
        </footer>
      </div>
    </div>
  );
};

export default DefinitionModal;
