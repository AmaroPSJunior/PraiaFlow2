import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

interface CountdownTimerProps {
  targetDate: Timestamp | Date;
  onComplete?: () => void;
  className?: string;
}

export default function CountdownTimer({ targetDate, onComplete, className }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const target = targetDate instanceof Timestamp ? targetDate.toDate() : targetDate;
      const now = new Date();
      const diff = target.getTime() - now.getTime();
      const seconds = Math.max(0, Math.floor(diff / 1000));
      setTimeLeft(seconds);
      
      if (seconds === 0 && onComplete) {
        onComplete();
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [targetDate, onComplete]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  if (timeLeft <= 0) return null;

  return (
    <div className={`flex items-center gap-1.5 font-mono font-bold ${className}`}>
      <Clock size={14} className="animate-pulse" />
      <span>{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}</span>
    </div>
  );
}
