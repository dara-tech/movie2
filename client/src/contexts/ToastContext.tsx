import React, { createContext, useContext, useState, useCallback } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { id, message, type };
    
    setToasts(prev => [...prev, newToast]);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer: React.FC<{ toasts: Toast[]; removeToast: (id: string) => void }> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`px-4 py-3 shadow-lg text-white max-w-sm transition-all duration-300 transform relative overflow-hidden group ${
            toast.type === 'success' 
              ? 'bg-green-600 border border-green-700 shadow-green-600/20' 
              : toast.type === 'error' 
              ? 'bg-red-600 border border-red-700 shadow-red-600/20' 
              : toast.type === 'warning'
              ? 'bg-amber-600 border border-amber-700 shadow-amber-600/20'
              : 'bg-blue-600 border border-blue-700 shadow-blue-600/20'
          }`}
        >
          {/* Accent bar */}
          <div className={`absolute left-0 top-0 bottom-0 w-1 ${
            toast.type === 'success' 
              ? 'bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.8)]' 
              : toast.type === 'error' 
              ? 'bg-red-400 shadow-[0_0_8px_rgba(220,38,38,0.8)]' 
              : toast.type === 'warning'
              ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
              : 'bg-blue-400 shadow-[0_0_8px_rgba(37,99,235,0.8)]'
          }`}></div>
          
          <div className="flex items-center justify-between ml-3">
            <span className="text-sm font-medium uppercase tracking-wide">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-2 text-white hover:text-gray-200 focus:outline-none hover:scale-110 transition-transform text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
