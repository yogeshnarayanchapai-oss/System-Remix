import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

const STORAGE_KEY = 'sensitive_data_visible';
const PIN_VERIFIED_UNTIL_KEY = 'sensitive_data_pin_verified_until';
const PIN_VALIDITY_MS = 24 * 60 * 60 * 1000;
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
  isPinVerified: boolean;
}

const SensitiveDataContext = createContext<SensitiveDataContextType | undefined>(undefined);

export function SensitiveDataProvider({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading: isRoleLoading } = useUserRole();
  
  // Default to OFF (false) always
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [pinVerifiedUntil, setPinVerifiedUntil] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;

    const storedExpiry = Number(window.localStorage.getItem(PIN_VERIFIED_UNTIL_KEY));
    return Number.isFinite(storedExpiry) && storedExpiry > Date.now() ? storedExpiry : 0;
  });

  // For editors, always show masked data regardless of toggle state
  const showSensitive = isAdmin ? isVisible : false;
  const isPinVerified = isAdmin && pinVerifiedUntil > Date.now();

  useEffect(() => {
    if (!isAdmin || !pinVerifiedUntil) return;

    const remainingMs = pinVerifiedUntil - Date.now();
    if (remainingMs <= 0) {
      window.localStorage.removeItem(PIN_VERIFIED_UNTIL_KEY);
      setPinVerifiedUntil(0);
      setIsVisible(false);
      return;
    }

    const expiryTimer = window.setTimeout(() => {
      window.localStorage.removeItem(PIN_VERIFIED_UNTIL_KEY);
      setPinVerifiedUntil(0);
      setIsVisible(false);
    }, remainingMs);

    return () => window.clearTimeout(expiryTimer);
  }, [isAdmin, pinVerifiedUntil]);

  const toggle = useCallback(() => {
    if (isAdmin) {
      if (isVisible) {
        // Turning OFF - no PIN needed
        setIsVisible(false);
      } else if (isPinVerified) {
        // A successful PIN verification remains valid for 24 hours.
        setIsVisible(true);
      }
      // Turning ON requires PIN - handled by verifyPin
    } else {
      toast.error('Access Restricted', {
        description: 'Please contact your administrator to view sensitive financial data.',
        duration: 4000,
      });
    }
  }, [isAdmin, isVisible, isPinVerified]);

  const verifyPin = useCallback((pin: string): boolean => {
    if (isAdmin && pin === SENSITIVE_PIN) {
      const verifiedUntil = Date.now() + PIN_VALIDITY_MS;
      window.localStorage.setItem(PIN_VERIFIED_UNTIL_KEY, String(verifiedUntil));
      setPinVerifiedUntil(verifiedUntil);
      setIsVisible(true);
      return true;
    }
    toast.error('Incorrect PIN');
    return false;
  }, [isAdmin]);
  
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
    toggleState: isAdmin ? isVisible : false,
    isPinVerified,
  }), [showSensitive, toggle, verifyPin, mask, isAdmin, isRoleLoading, isVisible, isPinVerified]);

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
  toggleState: false,
  isPinVerified: false
};

export function useSensitiveData() {
  const context = useContext(SensitiveDataContext);
  return context ?? defaultValue;
}
