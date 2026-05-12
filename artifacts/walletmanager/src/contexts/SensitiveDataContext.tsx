import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

const STORAGE_KEY = 'sensitive_data_visible';
const MASK = '••••••';
const SENSITIVE_PIN = '5655';

interface SensitiveDataContextType {
  isVisible: boolean;
  toggle: () => void;
  verifyPin: (pin: string) => boolean;
  mask: (value: string | number) => string;
  MASK: string;
  isAdmin: boolean;
  isRoleLoading: boolean;
  toggleState: boolean;
}

const SensitiveDataContext = createContext<SensitiveDataContextType | undefined>(undefined);

export function SensitiveDataProvider({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading: isRoleLoading } = useUserRole();
  
  // Default to OFF (false) always
  const [isVisible, setIsVisible] = useState<boolean>(false);

  // For editors, always show masked data regardless of toggle state
  const showSensitive = isAdmin ? isVisible : false;

  const toggle = useCallback(() => {
    if (isAdmin) {
      if (isVisible) {
        // Turning OFF - no PIN needed
        setIsVisible(false);
      }
      // Turning ON requires PIN - handled by verifyPin
    } else {
      toast.error('Access Restricted', {
        description: 'Please contact your administrator to view sensitive financial data.',
        duration: 4000,
      });
    }
  }, [isAdmin, isVisible]);

  const verifyPin = useCallback((pin: string): boolean => {
    if (pin === SENSITIVE_PIN) {
      setIsVisible(true);
      return true;
    }
    toast.error('Incorrect PIN');
    return false;
  }, []);
  
  const mask = useCallback((value: string | number): string => {
    return showSensitive ? String(value) : MASK;
  }, [showSensitive]);

  const value = useMemo(() => ({
    isVisible: showSensitive,
    toggle,
    verifyPin,
    mask,
    MASK,
    isAdmin,
    isRoleLoading,
    toggleState: isAdmin ? isVisible : false
  }), [showSensitive, toggle, verifyPin, mask, isAdmin, isRoleLoading, isVisible]);

  return (
    <SensitiveDataContext.Provider value={value}>
      {children}
    </SensitiveDataContext.Provider>
  );
}

const defaultValue: SensitiveDataContextType = {
  isVisible: false,
  toggle: () => {},
  verifyPin: () => false,
  mask: (value: string | number) => MASK,
  MASK,
  isAdmin: false,
  isRoleLoading: false,
  toggleState: false
};

export function useSensitiveData() {
  const context = useContext(SensitiveDataContext);
  return context ?? defaultValue;
}
