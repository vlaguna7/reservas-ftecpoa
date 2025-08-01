import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Alert {
  id: string;
  title: string;
  message: string;
  duration: number;
}

interface AlertPopupProps {
  alert: Alert;
  onClose: () => void;
}

export const AlertPopup = ({ alert, onClose }: AlertPopupProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show popup with animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    
    // Auto-close after duration
    const autoCloseTimer = setTimeout(() => {
      handleClose();
    }, alert.duration * 1000);

    return () => {
      clearTimeout(timer);
      clearTimeout(autoCloseTimer);
    };
  }, [alert.duration]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(), 300); // Wait for animation to complete
  };

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md mx-auto px-4 transition-all duration-300 ${
      isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
    }`}>
      <div className="bg-blue-900 text-white rounded-lg shadow-lg border border-blue-700">
        <div className="p-4">
          <div className="flex justify-between items-start">
            <div className="flex-1 pr-3">
              <h3 className="text-lg font-semibold mb-2">{alert.title}</h3>
              <p className="text-sm text-blue-100 leading-relaxed">{alert.message}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="text-white hover:bg-blue-800 h-8 w-8 p-0 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};