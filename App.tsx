/**
 * ClientS - Call Response Automation App
 * 
 * GITHUB SETUP INSTRUCTIONS:
 * ===========================
 * Before uploading to GitHub, DO NOT commit your real Supabase credentials!
 * 
 * 1. Create a file: src/utils/supabase.ts with this structure:
 *    ```typescript
 *    import { createClient } from '@supabase/supabase-js';
 *    
 *    const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
 *    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
 *    
 *    export const supabase = createClient(supabaseUrl, supabaseAnonKey);
 *    ```
 * 
 * 2. Add to .gitignore:
 *    src/utils/supabase.ts
 *    .env
 *    .env.local
 * 
 * 3. Create .env.example for collaborators:
 *    SUPABASE_URL=https://your-project.supabase.co
 *    SUPABASE_ANON_KEY=your-anon-key-here
 * 
 * 4. In production, replace with secure environment variables.
 * 
 * © 2026 David Figueiredo. All rights reserved.
 */

import { StatusBar } from 'expo-status-bar';
import { 
  StyleSheet, 
  Text, 
  View, 
  Switch, 
  TextInput, 
  TouchableOpacity, 
  ScrollView,
  Alert,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
  AppState
} from 'react-native';
import { useEffect, useState } from 'react';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import * as Contacts from 'expo-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './src/utils/supabase';
import { requestAllPermissions, checkAllPermissions } from './src/utils/permissions';
import CallKeeper from './modules/expo-call-keeper';

// ═══════════════════════════════════════════════════════════════════════════
// 📦 ASYNCSTORAGE KEYS (CENTRALIZED)
// ═══════════════════════════════════════════════════════════════════════════
const STORAGE_KEYS = {
  SERVICE_ACTIVE: '@CallKeeper:serviceActive',
  AUTO_MESSAGE: '@CallKeeper:autoMessage', // DEPRECATED - kept for migration
  MESSAGE_TEMPLATES: '@CallKeeper:messageTemplates',
  ACTIVE_TEMPLATE_INDEX: '@CallKeeper:activeTemplateIndex',
  DELAY: '@CallKeeper:delay',
  IGNORE_CONTACTS: '@CallKeeper:ignoreContacts',
  BLACKLIST: '@CallKeeper:blacklist',
  VIP_LIST: '@CallKeeper:vipList',
  SMS_LOGS: '@CallKeeper:smsLogs',
  ANTI_SPAM_ENABLED: '@CallKeeper:antiSpamEnabled',
  LAST_CALL_TIMESTAMPS: '@CallKeeper:lastCallTimestamps',
} as const;

const DEFAULT_MESSAGE = "Olá! Não posso atender agora. Assim que possível, entrarei em contacto. Obrigado.";

const DEFAULT_TEMPLATES = [
  "Olá! Não posso atender agora. Assim que possível, entrarei em contacto. Obrigado.",
  "Recebida a sua chamada. Encontro-me ocupado neste momento, mas retorno o contacto em breve.",
  "Obrigado pela sua chamada. Irei retornar assim que me for possível. Tenha um bom dia!"
];

// ═══════════════════════════════════════════════════════════════════════════
// 📞 PHONE NUMBER FORMATTING HELPER
// ═══════════════════════════════════════════════════════════════════════════
const formatPhoneNumber = (number: string): string => {
  if (!number) return '';
  
  // Remove all spaces first
  const cleaned = number.replace(/\s+/g, '');
  
  // Format: +351 912 345 678 or similar patterns
  if (cleaned.startsWith('+')) {
    // International format: +XXX XXX XXX XXX
    const match = cleaned.match(/^(\+\d{1,3})(\d{3})(\d{3})(\d+)$/);
    if (match) {
      return `${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
    }
    // Fallback: +XXX XXXXXXXXX
    const match2 = cleaned.match(/^(\+\d{1,3})(\d+)$/);
    if (match2) {
      const rest = match2[2];
      const formatted = rest.match(/.{1,3}/g)?.join(' ') || rest;
      return `${match2[1]} ${formatted}`;
    }
  }
  
  // National format: 912 345 678
  if (cleaned.length === 9) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  }
  
  // Return as-is if no pattern matches
  return number;
};

// ═══════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════
interface SmsLog {
  number: string;
  timestamp: number;
  template: 'A' | 'B' | 'C';
}

interface CallTimestamp {
  [phoneNumber: string]: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ ROBUST ASYNCSTORAGE HELPERS (with try/catch and JSON handling)
// ═══════════════════════════════════════════════════════════════════════════

const safeGetString = async (key: string, defaultValue: string): Promise<string> => {
  try {
    const value = await AsyncStorage.getItem(key);
    return value !== null ? value : defaultValue;
  } catch (error) {
    console.error(`Error reading ${key}:`, error);
    return defaultValue;
  }
};

const safeSetString = async (key: string, value: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, value);
    console.log(`✅ Saved ${key}:`, value);
  } catch (error) {
    console.error(`❌ Error saving ${key}:`, error);
  }
};

const safeGetBoolean = async (key: string, defaultValue: boolean): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(key);
    return value !== null ? value === 'true' : defaultValue;
  } catch (error) {
    console.error(`Error reading ${key}:`, error);
    return defaultValue;
  }
};

const safeSetBoolean = async (key: string, value: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, value.toString());
    console.log(`✅ Saved ${key}:`, value);
  } catch (error) {
    console.error(`❌ Error saving ${key}:`, error);
  }
};

const safeGetNumber = async (key: string, defaultValue: number): Promise<number> => {
  try {
    const value = await AsyncStorage.getItem(key);
    return value !== null ? parseFloat(value) : defaultValue;
  } catch (error) {
    console.error(`Error reading ${key}:`, error);
    return defaultValue;
  }
};

const safeSetNumber = async (key: string, value: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, value.toString());
    console.log(`✅ Saved ${key}:`, value);
  } catch (error) {
    console.error(`❌ Error saving ${key}:`, error);
  }
};

const safeGetArray = async (key: string, defaultValue: string[]): Promise<string[]> => {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value !== null) {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : defaultValue;
    }
    return defaultValue;
  } catch (error) {
    console.error(`Error reading ${key}:`, error);
    return defaultValue;
  }
};

const safeSetArray = async (key: string, value: string[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    console.log(`✅ Saved ${key}:`, value);
  } catch (error) {
    console.error(`❌ Error saving ${key}:`, error);
  }
};

const safeGetObject = async <T,>(key: string, defaultValue: T): Promise<T> => {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value !== null) {
      const parsed = JSON.parse(value);
      return parsed as T;
    }
    return defaultValue;
  } catch (error) {
    console.error(`Error reading ${key}:`, error);
    return defaultValue;
  }
};

const safeSetObject = async <T,>(key: string, value: T): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    console.log(`✅ Saved ${key}`);
  } catch (error) {
    console.error(`❌ Error saving ${key}:`, error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// 📱 MAIN APP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function App() {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔐 LICENSE & AUTH STATES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const [isLicenseValid, setIsLicenseValid] = useState(false);
  const [isCheckingLicense, setIsCheckingLicense] = useState(true);
  const [deviceId, setDeviceId] = useState('');
  const [lastError, setLastError] = useState('');
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🕵️ DEBUG MODE (Secret 5-tap activation)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const [debugTapCount, setDebugTapCount] = useState(0);
  const [debugTimer, setDebugTimer] = useState<NodeJS.Timeout | null>(null);
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📋 COPY FEEDBACK STATES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const [copiedDeviceId, setCopiedDeviceId] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📱 CONTACT PICKER MODAL STATES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactPickerMode, setContactPickerMode] = useState<'blacklist' | 'vip'>('blacklist');
  const [allContacts, setAllContacts] = useState<Array<{name: string, number: string}>>([]);
  const [filteredContacts, setFilteredContacts] = useState<Array<{name: string, number: string}>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🎛️ APP CORE STATES (All persisted with AsyncStorage)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const [isServiceActive, setIsServiceActive] = useState(false);
  const [autoMessage, setAutoMessage] = useState(DEFAULT_MESSAGE);
  const [messageTemplates, setMessageTemplates] = useState<string[]>(DEFAULT_TEMPLATES);
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(0);
  const [delayMinutes, setDelayMinutes] = useState('0');
  const [delaySeconds, setDelaySeconds] = useState('30');
  const [ignoreContacts, setIgnoreContacts] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [vipList, setVipList] = useState<string[]>([]);
  const [newNumber, setNewNumber] = useState('');
  const [newVipNumber, setNewVipNumber] = useState('');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🆕 PRO FEATURES STATES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [antiSpamEnabled, setAntiSpamEnabled] = useState(false);
  const [lastCallTimestamps, setLastCallTimestamps] = useState<CallTimestamp>({});

  // ═══════════════════════════════════════════════════════════════════════════
  // 🚀 INITIALIZATION: Load License & Settings on App Start
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    checkLicense();
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔄 SYNC LOGS FROM NATIVE MODULE (Main sync function)
  // ═══════════════════════════════════════════════════════════════════════════
  const syncLogsFromNative = async () => {
    try {
      console.log('🔄 Syncing logs from native module...');
      
      // 📊 LER LOGS DO MÓDULO NATIVO (formato: timestamp|número|template)
      const nativeHistoryString = await CallKeeper.getSmsHistory();
      
      if (nativeHistoryString && nativeHistoryString.trim() !== '') {
        const lines = nativeHistoryString.split('\n').filter((line: string) => line.trim() !== '');
        const parsedLogs: SmsLog[] = [];
        
        for (const line of lines) {
          const parts = line.split('|');
          if (parts.length === 3) {
            const [timestampStr, number, template] = parts;
            const timestamp = parseInt(timestampStr, 10);
            
            if (!isNaN(timestamp)) {
              parsedLogs.push({
                number: number.trim(),
                timestamp: timestamp,
                template: template.trim() as 'A' | 'B' | 'C'
              });
            }
          }
        }
        
        // Ordenar por timestamp (mais recente primeiro) e limitar a 15
        const sortedLogs = parsedLogs
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 15);
        
        setSmsLogs(sortedLogs);
        console.log(`✅ Synced ${sortedLogs.length} logs from native module`);
        return sortedLogs;
        
      } else {
        console.log('ℹ️ No SMS logs found (normal if no SMS sent yet)');
        setSmsLogs([]);
        return [];
      }
      
    } catch (error) {
      console.error('❌ Error syncing logs from native:', error);
      setSmsLogs([]);
      return [];
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔄 AUTO-SYNC: Refresh when app becomes active
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // Sync on mount
    syncLogsFromNative();
    
    // Listen for app state changes
    const subscription = Platform.OS === 'android' ? 
      // Android: Use AppState
      require('react-native').AppState.addEventListener('change', (state: string) => {
        if (state === 'active') {
          console.log('📱 App became active - syncing logs...');
          syncLogsFromNative();
        }
      }) : null;

    return () => {
      subscription?.remove();
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // 💾 AUTO-SAVE: Save Service State whenever it changes
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isLoading) {
      safeSetBoolean(STORAGE_KEYS.SERVICE_ACTIVE, isServiceActive);
    }
  }, [isServiceActive]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 💾 AUTO-SAVE: Save Auto Message whenever it changes
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isLoading && autoMessage) {
      safeSetString(STORAGE_KEYS.AUTO_MESSAGE, autoMessage);
    }
  }, [autoMessage]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 💾 AUTO-SAVE: Save Message Templates whenever they change
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isLoading) {
      safeSetArray(STORAGE_KEYS.MESSAGE_TEMPLATES, messageTemplates);
    }
  }, [messageTemplates]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 💾 AUTO-SAVE: Save Active Template Index whenever it changes
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isLoading) {
      safeSetNumber(STORAGE_KEYS.ACTIVE_TEMPLATE_INDEX, activeTemplateIndex);
      
      // 🔄 SYNC para o módulo nativo (CRITICAL para funcionar em background!)
      CallKeeper.setActiveTemplateIndex(activeTemplateIndex);
      console.log(`✅ Template index ${activeTemplateIndex} synced to native module`);
      
      // Update autoMessage to match active template
      if (messageTemplates[activeTemplateIndex]) {
        setAutoMessage(messageTemplates[activeTemplateIndex]);
      }
    }
  }, [activeTemplateIndex]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 💾 AUTO-SAVE: Save Delay whenever minutes/seconds change
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isLoading) {
      const mins = parseInt(delayMinutes) || 0;
      const secs = parseInt(delaySeconds) || 0;
      const totalMinutes = mins + (secs / 60);
      safeSetNumber(STORAGE_KEYS.DELAY, totalMinutes);
    }
  }, [delayMinutes, delaySeconds]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 💾 AUTO-SAVE: Save Ignore Contacts whenever it changes
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isLoading) {
      safeSetBoolean(STORAGE_KEYS.IGNORE_CONTACTS, ignoreContacts);
      try {
        CallKeeper.setIgnoreContacts(ignoreContacts);
      } catch (error) {
        console.error('Error syncing ignoreContacts:', error);
      }
    }
  }, [ignoreContacts]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 💾 AUTO-SAVE: Save Blacklist whenever it changes
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isLoading) {
      safeSetArray(STORAGE_KEYS.BLACKLIST, blacklist);
      try {
        CallKeeper.setBlacklist(blacklist);
      } catch (error) {
        console.error('Error syncing blacklist:', error);
      }
    }
  }, [blacklist]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 💾 AUTO-SAVE: Save VIP List whenever it changes
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isLoading) {
      safeSetArray(STORAGE_KEYS.VIP_LIST, vipList);
      try {
        CallKeeper.setVipList(vipList);
      } catch (error) {
        console.error('Error syncing vipList:', error);
      }
    }
  }, [vipList]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 💾 AUTO-SAVE: Save Anti-Spam State whenever it changes
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isLoading) {
      safeSetBoolean(STORAGE_KEYS.ANTI_SPAM_ENABLED, antiSpamEnabled);
      // 🔄 SYNC para o módulo nativo (CRITICAL para funcionar em background!)
      CallKeeper.setAntiSpamEnabled(antiSpamEnabled);
      console.log(`🕒 Anti-Spam synced to native: ${antiSpamEnabled ? 'ATIVO' : 'INATIVO'}`);
    }
  }, [antiSpamEnabled]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 💾 AUTO-SAVE: Save Last Call Timestamps whenever they change
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isLoading) {
      safeSetObject(STORAGE_KEYS.LAST_CALL_TIMESTAMPS, lastCallTimestamps);
    }
  }, [lastCallTimestamps]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔐 LICENSE CHECK (Silent, no alerts unless critical error)
  // ═══════════════════════════════════════════════════════════════════════════
  const checkLicense = async () => {
    try {
      console.log('🔐 Verificando licença...');
      console.log('   - Supabase Client:', !!supabase ? 'OK' : 'ERRO');
      
      const androidId = await Application.getAndroidId();
      setDeviceId(androidId || 'UNKNOWN');
      console.log('   - Android ID:', androidId || 'NÃO OBTIDO');

      if (!androidId) {
        setLastError('Android ID não foi obtido. Dispositivo incompatível.');
        setIsLicenseValid(false);
        setIsCheckingLicense(false);
        return;
      }

      console.log('📡 Consultando Supabase...');
      console.log('   - Device ID:', androidId);

      const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .eq('device_id', androidId?.trim())
        .single();

      console.log('📥 Resposta recebida');
      console.log('   - Error:', error ? 'SIM' : 'NÃO');
      console.log('   - Data:', data ? 'SIM' : 'NÃO');

      if (error) {
        const errorMsg = `${error.message} (${error.code})`;
        setLastError(errorMsg);
        console.error('❌ Erro Supabase:', JSON.stringify(error, null, 2));
        
        if (error.message.includes('Invalid API key') || error.message.includes('network')) {
          Alert.alert(
            'Erro de Conexão', 
            'Não foi possível verificar a licença. Verifique sua conexão à internet e tente novamente.'
          );
        }
        
        setIsLicenseValid(false);
        setIsCheckingLicense(false);
        return;
      }

      if (!data) {
        setLastError(`Device ID "${androidId}" não encontrado na base de dados.`);
        console.log('❌ ID não encontrado');
        setIsLicenseValid(false);
        setIsCheckingLicense(false);
        return;
      }

      console.log('📊 Dados:', { device_id: data.device_id, is_active: data.is_active });

      if (!data.is_active) {
        setLastError(`Licença inativa (is_active = false)`);
        console.log('⚠️ Licença inativa');
        setIsLicenseValid(false);
        setIsCheckingLicense(false);
        return;
      }

      console.log('✅ Licença válida! Inicializando app...');
      setLastError('');
      setIsLicenseValid(true);
      
      await initializeApp();
      
    } catch (error: any) {
      const errorMsg = `${error.name}: ${error.message}`;
      setLastError(errorMsg);
      console.error('❌ Erro crítico:', error);
      
      Alert.alert(
        'Erro Inesperado', 
        'Ocorreu um erro ao verificar a licença. Por favor, tente novamente.'
      );
      
      setIsLicenseValid(false);
    } finally {
      setIsCheckingLicense(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 🚀 INITIALIZE APP: Load all settings from AsyncStorage
  // ═══════════════════════════════════════════════════════════════════════════
  const initializeApp = async () => {
    try {
      console.log('📦 Loading all settings from AsyncStorage...');
      
      // Load all settings in parallel for better performance
      const [
        savedServiceActive,
        savedAutoMessage,
        savedMessageTemplates,
        savedActiveTemplateIndex,
        savedDelay,
        savedIgnoreContacts,
        savedBlacklist,
        savedVipList,
        savedAntiSpamEnabled,
        savedLastCallTimestamps,
      ] = await Promise.all([
        safeGetBoolean(STORAGE_KEYS.SERVICE_ACTIVE, false),
        safeGetString(STORAGE_KEYS.AUTO_MESSAGE, DEFAULT_MESSAGE),
        safeGetArray(STORAGE_KEYS.MESSAGE_TEMPLATES, DEFAULT_TEMPLATES),
        safeGetNumber(STORAGE_KEYS.ACTIVE_TEMPLATE_INDEX, 0),
        safeGetNumber(STORAGE_KEYS.DELAY, 0.5),
        safeGetBoolean(STORAGE_KEYS.IGNORE_CONTACTS, true),
        safeGetArray(STORAGE_KEYS.BLACKLIST, []),
        safeGetArray(STORAGE_KEYS.VIP_LIST, []),
        safeGetBoolean(STORAGE_KEYS.ANTI_SPAM_ENABLED, false),
        safeGetObject<CallTimestamp>(STORAGE_KEYS.LAST_CALL_TIMESTAMPS, {}),
      ]);

      console.log('✅ Settings loaded:', {
        serviceActive: savedServiceActive,
        autoMessage: savedAutoMessage.substring(0, 30) + '...',
        messageTemplates: savedMessageTemplates.length,
        activeTemplateIndex: savedActiveTemplateIndex,
        delay: savedDelay,
        ignoreContacts: savedIgnoreContacts,
        blacklist: savedBlacklist,
        vipList: savedVipList,
        antiSpamEnabled: savedAntiSpamEnabled,
      });

      // Apply loaded settings to state
      setIsServiceActive(savedServiceActive);
      
      // Handle template migration from old single message
      let finalTemplates = savedMessageTemplates;
      if (finalTemplates.length === 0) {
        finalTemplates = [...DEFAULT_TEMPLATES];
        if (savedAutoMessage && savedAutoMessage !== DEFAULT_MESSAGE) {
          finalTemplates[0] = savedAutoMessage;
        }
      }
      
      setMessageTemplates(finalTemplates);
      setActiveTemplateIndex(Math.min(savedActiveTemplateIndex, finalTemplates.length - 1));
      setAutoMessage(finalTemplates[Math.min(savedActiveTemplateIndex, finalTemplates.length - 1)]);
      
      const delayMins = Math.floor(savedDelay);
      const delaySecs = Math.round((savedDelay - delayMins) * 60);
      setDelayMinutes(delayMins.toString());
      setDelaySeconds(delaySecs.toString());
      
      setIgnoreContacts(savedIgnoreContacts);
      setBlacklist(savedBlacklist);
      setVipList(savedVipList);
      // SMS Logs are loaded from Native Module via syncLogsFromNative()
      setAntiSpamEnabled(savedAntiSpamEnabled);
      setLastCallTimestamps(savedLastCallTimestamps);

      // Request Android permissions
      if (Platform.OS === 'android') {
        try {
          const permissions = [
            PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
            PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
            PermissionsAndroid.PERMISSIONS.SEND_SMS,
            PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
          ];
          
          const results = await PermissionsAndroid.requestMultiple(permissions);
          
          const allGranted = Object.values(results).every(
            r => r === PermissionsAndroid.RESULTS.GRANTED
          );
          
          setHasPermissions(allGranted);
          
          if (!allGranted) {
            Alert.alert(
              '⚠️ Permissões Necessárias',
              'Sem todas as permissões, a app não funcionará corretamente.',
              [{ text: 'OK', style: 'cancel' }]
            );
          }
        } catch (error) {
          console.error('Erro ao solicitar permissões:', error);
          setHasPermissions(false);
        }
      } else {
        setHasPermissions(true);
      }
      
      // Sync settings to native module
      try {
        console.log('🔄 Syncing settings to native module...');
        await CallKeeper.setIgnoreContacts(savedIgnoreContacts);
        await CallKeeper.setBlacklist(savedBlacklist);
        await CallKeeper.setVipList(savedVipList);
        console.log('✅ All settings synced to native module');
      } catch (error) {
        console.error('❌ Error syncing to native module:', error);
      }
      
      // Restart service if it was active
      const permissionsGranted = Platform.OS === 'android' 
        ? await checkAllPermissions() 
        : true;
      
      if (savedServiceActive && permissionsGranted) {
        try {
          console.log('🔄 Restarting service...');
          const success = await CallKeeper.startService(savedAutoMessage, savedDelay);
          if (!success) {
            console.error('❌ Failed to restart service');
            setIsServiceActive(false);
          } else {
            console.log('✅ Service restarted successfully');
          }
        } catch (serviceError) {
          console.error('❌ Error restarting service:', serviceError);
          setIsServiceActive(false);
        }
      }
      
    } catch (error) {
      console.error('❌ Error in initialization:', error);
    } finally {
      setIsLoading(false);
      console.log('✅ Initialization complete');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 🕵️ SECRET DEBUG MODE (5 taps on version)
  // ═══════════════════════════════════════════════════════════════════════════
  const handleDebugTap = () => {
    const newCount = debugTapCount + 1;
    setDebugTapCount(newCount);

    if (debugTimer) {
      clearTimeout(debugTimer);
    }
    
    const timer = setTimeout(() => {
      setDebugTapCount(0);
    }, 2000);
    setDebugTimer(timer);

    if (newCount === 5) {
      setDebugTapCount(0);
      if (debugTimer) {
        clearTimeout(debugTimer);
      }
      
      Alert.alert(
        '🔧 DEBUG MODE',
        `Device ID:\n${deviceId}\n\nSupabase Status:\n${!!supabase ? '✅ Conectado' : '❌ Erro'}\n\nLast Error:\n${lastError || 'Nenhum erro'}\n\nLicense Valid:\n${isLicenseValid ? 'SIM' : 'NÃO'}`,
        [
          {
            text: 'Copiar Device ID',
            onPress: async () => {
              await Clipboard.setStringAsync(deviceId);
              Alert.alert('✅ Copiado', 'Device ID copiado para a área de transferência');
            }
          },
          { text: 'Fechar', style: 'cancel' }
        ]
      );
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 📋 COPY ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const copyDeviceId = async () => {
    try {
      await Clipboard.setStringAsync(deviceId);
      setCopiedDeviceId(true);
      setTimeout(() => setCopiedDeviceId(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar Device ID:', error);
    }
  };

  const copyPhoneNumber = async () => {
    try {
      await Clipboard.setStringAsync('934434720');
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar número:', error);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 📱 CONTACT PICKER MODAL
  // ═══════════════════════════════════════════════════════════════════════════
  const openContactPicker = async (mode: 'blacklist' | 'vip') => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão Negada', 'Necessita permitir acesso aos contactos.');
        return;
      }

      setContactPickerMode(mode);
      
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });

      if (data && data.length > 0) {
        const contactList = data
          .filter(c => c.phoneNumbers && c.phoneNumbers.length > 0)
          .map(c => ({
            name: c.name || 'Sem nome',
            number: c.phoneNumbers![0].number?.replace(/\s+/g, '') || '',
          }))
          .filter(c => c.number.length > 0);

        if (contactList.length === 0) {
          Alert.alert('Aviso', 'Nenhum contacto com número de telefone encontrado.');
          return;
        }

        setAllContacts(contactList);
        setFilteredContacts(contactList);
        setSearchQuery('');
        setShowContactModal(true);
      } else {
        Alert.alert('Aviso', 'Nenhum contacto encontrado.');
      }
    } catch (error) {
      console.error('Erro ao abrir contactos:', error);
      Alert.alert('Erro', 'Não foi possível aceder aos contactos.');
    }
  };

  const handleSearchContacts = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredContacts(allContacts);
    } else {
      const filtered = allContacts.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.number.includes(query)
      );
      setFilteredContacts(filtered);
    }
  };

  const selectContact = (contact: {name: string, number: string}) => {
    const cleanNumber = contact.number.trim();
    
    if (contactPickerMode === 'blacklist') {
      setNewNumber(cleanNumber);
    } else {
      setNewVipNumber(cleanNumber);
    }
    
    setShowContactModal(false);
    setSearchQuery('');
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 📊 PRO FEATURE: SMS LOG MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  // NOTE: All SMS logging now happens in Native Module (CallKeeperService.kt)
  // React Native just READS the logs via syncLogsFromNative()
  // Logs auto-rotate (FIFO) at 15 entries - no manual clear needed

  // ═══════════════════════════════════════════════════════════════════════════
  // 🛡️ PRO FEATURE: ANTI-SPAM LOGIC
  // ═══════════════════════════════════════════════════════════════════════════
  // ⚠️ NOTE: Anti-Spam logic now runs 100% in Native Module (SMSHandler.kt)
  // React Native only displays UI status. The real blocking happens in Kotlin.
  //
  // Native Module Rules:
  // - VIP Numbers: 10-minute threshold (600,000 ms)
  // - Regular Numbers: 30-minute threshold (1,800,000 ms)
  // - Timestamps are ALWAYS saved after sending (even if Anti-Spam is OFF)
  // - This ensures turning ON the filter later respects previous sends
  
  // Legacy React-side check (kept for UI feedback only - not authoritative)
  const shouldBlockDueToAntiSpam = (phoneNumber: string): boolean => {
    if (!antiSpamEnabled) return false;
    
    // VIPs always bypass anti-spam
    if (vipList.includes(phoneNumber)) return false;
    
    const lastCallTime = lastCallTimestamps[phoneNumber];
    if (!lastCallTime) return false;
    
    const thirtyMinutesInMs = 30 * 60 * 1000;
    const timeSinceLastCall = Date.now() - lastCallTime;
    
    return timeSinceLastCall < thirtyMinutesInMs;
  };

  const updateCallTimestamp = (phoneNumber: string) => {
    setLastCallTimestamps(prev => ({
      ...prev,
      [phoneNumber]: Date.now()
    }));
  };

  const getTimeUntilCanSendAgain = (phoneNumber: string): string => {
    const lastCallTime = lastCallTimestamps[phoneNumber];
    if (!lastCallTime) return '';
    
    const thirtyMinutesInMs = 30 * 60 * 1000;
    const timeSinceLastCall = Date.now() - lastCallTime;
    const timeRemaining = thirtyMinutesInMs - timeSinceLastCall;
    
    if (timeRemaining <= 0) return '';
    
    const minutesRemaining = Math.ceil(timeRemaining / 60000);
    return `${minutesRemaining} min`;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎛️ SERVICE CONTROLS
  // ═══════════════════════════════════════════════════════════════════════════
  const toggleService = async (value: boolean) => {
    try {
      if (!hasPermissions) {
        Alert.alert('Permissões Necessárias', 'Por favor conceda todas as permissões.');
        return;
      }

      const currentMessage = messageTemplates[activeTemplateIndex] || autoMessage;

      if (!currentMessage.trim()) {
        Alert.alert('Erro', 'A mensagem não pode estar vazia.');
        return;
      }

      if (value) {
        const mins = parseInt(delayMinutes) || 0;
        const secs = parseInt(delaySeconds) || 0;
        const totalMinutes = mins + (secs / 60);
        
        const success = await CallKeeper.startService(currentMessage, totalMinutes);
        
        if (success) {
          setIsServiceActive(true);
        } else {
          Alert.alert('Erro', 'Não foi possível iniciar o serviço.');
        }
      } else {
        await CallKeeper.stopService();
        setIsServiceActive(false);
      }
    } catch (error) {
      console.error('Erro ao atualizar serviço:', error);
      Alert.alert('Erro Crítico', `Ocorreu um erro: ${error}`);
      setIsServiceActive(false);
    }
  };

  const handleSaveTemplate = async (index: number, newText: string) => {
    if (!newText.trim()) {
      Alert.alert('Erro', 'A mensagem não pode estar vazia.');
      return;
    }
    
    const updated = [...messageTemplates];
    updated[index] = newText;
    setMessageTemplates(updated);
    
    // If this is the active template, update autoMessage too
    if (index === activeTemplateIndex) {
      setAutoMessage(newText);
      
      // Restart service if active
      if (isServiceActive) {
        const templateMins = parseInt(delayMinutes) || 0;
        const templateSecs = parseInt(delaySeconds) || 0;
        const templateTotalMinutes = templateMins + (templateSecs / 60);
        
        await CallKeeper.stopService();
        await CallKeeper.startService(newText, templateTotalMinutes);
      }
    }
    
    Alert.alert('✅ Sucesso', 'Template guardado!');
  };

  const handleSaveMessage = async () => {
    const currentMessage = messageTemplates[activeTemplateIndex] || autoMessage;
    
    if (!currentMessage.trim()) {
      Alert.alert('Erro', 'A mensagem não pode estar vazia.');
      return;
    }
    
    if (isServiceActive) {
      const mins = parseInt(delayMinutes) || 0;
      const secs = parseInt(delaySeconds) || 0;
      const totalMinutes = mins + (secs / 60);
      
      await CallKeeper.stopService();
      await CallKeeper.startService(currentMessage, totalMinutes);
    }
    
    Alert.alert('✅ Sucesso', 'Mensagem guardada!');
  };

  const handleApplyDelay = async () => {
    const applyMins = parseInt(delayMinutes) || 0;
    const applySecs = parseInt(delaySeconds) || 0;
    
    if (applyMins === 0 && applySecs === 0) {
      Alert.alert('Erro', 'O tempo de espera deve ser maior que 0.');
      return;
    }
    
    if (applySecs >= 60) {
      Alert.alert('Erro', 'Os segundos devem ser menores que 60.');
      return;
    }
    
    const totalMinutes = applyMins + (applySecs / 60);
    
    if (isServiceActive) {
      await CallKeeper.stopService();
      await CallKeeper.startService(autoMessage, totalMinutes);
    }
    
    Alert.alert('✅ Sucesso', 'Tempo aplicado!');
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 🚫 BLACKLIST MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAddToBlacklist = async () => {
    const cleanNumber = newNumber.trim();
    
    if (!cleanNumber) {
      Alert.alert('Erro', 'Digite um número válido.');
      return;
    }

    if (vipList.includes(cleanNumber)) {
      Alert.alert(
        'Erro de Duplicação',
        'Este número já está na sua Lista VIP. Remova-o de lá antes de o adicionar à Blacklist.'
      );
      return;
    }

    if (blacklist.includes(cleanNumber)) {
      Alert.alert('Aviso', 'Este número já está na lista.');
      return;
    }

    setBlacklist([...blacklist, cleanNumber]);
    setNewNumber('');
  };

  const handleRemoveFromBlacklist = async (number: string) => {
    setBlacklist(blacklist.filter(n => n !== number));
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 🌟 VIP LIST MANAGEMENT (Absolute Priority)
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAddToVIP = async () => {
    const cleanNumber = newVipNumber.trim();
    
    if (!cleanNumber) {
      Alert.alert('Erro', 'Digite um número válido.');
      return;
    }

    if (blacklist.includes(cleanNumber)) {
      Alert.alert(
        'Erro de Duplicação',
        'Este número já está na sua Blacklist. Remova-o de lá antes de o adicionar como VIP.'
      );
      return;
    }

    if (vipList.includes(cleanNumber)) {
      Alert.alert('Aviso', 'Este número já está na lista VIP.');
      return;
    }

    setVipList([...vipList, cleanNumber]);
    setNewVipNumber('');
  };

  const handleRemoveFromVIP = async (number: string) => {
    setVipList(vipList.filter(n => n !== number));
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 🖥️ UI RENDERING
  // ═══════════════════════════════════════════════════════════════════════════

  // Loading License Screen
  if (isCheckingLicense) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>A verificar licença...</Text>
      </View>
    );
  }

  // Lock Screen (Invalid License)
  if (!isLicenseValid) {
    return (
      <View style={styles.lockContainer}>
        <StatusBar style="light" />
        <View style={styles.lockContent}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.lockTitle}>Acesso Restrito</Text>
          
          <View style={styles.deviceIdCard}>
            <View style={styles.cardRow}>
              <View style={styles.cardTextContent}>
                <Text style={styles.deviceIdLabel}>ID do Dispositivo:</Text>
                <Text style={styles.deviceIdValue} selectable>{deviceId}</Text>
              </View>
              <TouchableOpacity 
                style={styles.copyButtonMinimal} 
                onPress={copyDeviceId}
                activeOpacity={0.7}
              >
                <Text style={styles.copyIconMinimal}>
                  {copiedDeviceId ? '✓' : '⎘'}
                </Text>
                <Text style={styles.copyLabelMinimal}>
                  {copiedDeviceId ? 'Copiado' : 'Copiar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>📱 Como Ativar:</Text>
            <View style={styles.paymentRow}>
              <View style={styles.paymentTextContent}>
                <Text style={styles.instructionsText}>
                  1. Envie 10€ via MB WAY para:
                </Text>
                <Text style={styles.phoneNumber}>934 434 720</Text>
              </View>
              <TouchableOpacity 
                style={styles.copyButtonMinimalSmall} 
                onPress={copyPhoneNumber}
                activeOpacity={0.7}
              >
                <Text style={styles.copyIconMinimal}>
                  {copiedPhone ? '✓' : '⎘'}
                </Text>
                <Text style={styles.copyLabelMinimalSmall}>
                  {copiedPhone ? 'Copiado' : 'Copiar'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.instructionsText}>
              2. Envie o ID acima por WhatsApp/SMS para o mesmo número
            </Text>
            <Text style={styles.instructionsText}>
              3. Aguarde a ativação (até 24h)
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={checkLicense}
            disabled={isCheckingLicense}
          >
            {isCheckingLicense ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.retryButtonText}>🔄 Verificar Novamente</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleDebugTap} style={styles.versionContainer}>
            <Text style={styles.versionText}>Versão 1.0.0</Text>
          </TouchableOpacity>

          <View style={styles.creditsContainer}>
            <Text style={styles.creditsText}>Desenvolvido para Android por David Figueiredo</Text>
            <Text style={styles.copyrightText}>© 2026 David Figueiredo. All rights reserved.</Text>
          </View>
        </View>
      </View>
    );
  }

  // Loading App Data Screen
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>A carregar...</Text>
      </View>
    );
  }

  // Main App Screen
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={styles.appTitle}>📞 ClientS</Text>
          <Text style={styles.appSubtitle}>Resposta Automática a Chamadas Perdidas</Text>
        </View>

        {/* SERVICE STATUS CARD */}
        <View style={[styles.card, isServiceActive && styles.statusCard]}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>Estado do Serviço</Text>
              <Text style={[
                styles.statusText,
                isServiceActive ? styles.statusActive : styles.statusInactive
              ]}>
                {isServiceActive ? '🟢 ATIVO' : '🔴 INATIVO'}
              </Text>
            </View>
            <Switch
              value={isServiceActive}
              onValueChange={toggleService}
              trackColor={{ false: '#444', true: '#4CAF50' }}
              thumbColor={isServiceActive ? '#fff' : '#ccc'}
            />
          </View>
        </View>

        {/* MESSAGE TEMPLATES CARD (A/B/C Testing) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💬 Gestor de Respostas</Text>
          <Text style={styles.filterDescription}>
            Crie 3 variantes de mensagem e selecione qual está ativa
          </Text>

          {/* Template Selector */}
          <View style={styles.templateSelector}>
            {['A', 'B', 'C'].map((letter, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.templateSelectorButton,
                  activeTemplateIndex === index && styles.templateSelectorButtonActive
                ]}
                onPress={() => setActiveTemplateIndex(index)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.templateSelectorText,
                  activeTemplateIndex === index && styles.templateSelectorTextActive
                ]}>{letter}</Text>
                {activeTemplateIndex === index && (
                  <Text style={styles.activeIndicator}>✓ ATIVA</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Active Template Editor */}
          <View style={styles.templateEditorContainer}>
            <Text style={styles.templateEditorLabel}>
              Editar Template {['A', 'B', 'C'][activeTemplateIndex]}:
            </Text>
            <TextInput
              style={styles.messageInput}
              value={messageTemplates[activeTemplateIndex]}
              onChangeText={(text) => {
                const updated = [...messageTemplates];
                updated[activeTemplateIndex] = text;
                setMessageTemplates(updated);
                setAutoMessage(text);
              }}
              placeholder="Digite a mensagem a enviar..."
              placeholderTextColor="#666"
              multiline
            />
            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={() => handleSaveTemplate(activeTemplateIndex, messageTemplates[activeTemplateIndex])}
            >
              <Text style={styles.saveButtonText}>💾 Guardar Template {['A', 'B', 'C'][activeTemplateIndex]}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* DELAY CARD */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⏱️ Tempo de Espera</Text>
          <View style={styles.timeInputContainer}>
            <View style={styles.timeInputGroup}>
              <Text style={styles.timeLabel}>Minutos</Text>
              <TextInput
                style={styles.timeInput}
                value={delayMinutes}
                onChangeText={setDelayMinutes}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#666"
              />
            </View>
            <Text style={styles.timeSeparator}>:</Text>
            <View style={styles.timeInputGroup}>
              <Text style={styles.timeLabel}>Segundos</Text>
              <TextInput
                style={styles.timeInput}
                value={delaySeconds}
                onChangeText={setDelaySeconds}
                keyboardType="numeric"
                placeholder="30"
                placeholderTextColor="#666"
              />
            </View>
          </View>
          <TouchableOpacity style={styles.saveButton} onPress={handleApplyDelay}>
            <Text style={styles.saveButtonText}>✅ Aplicar Tempo</Text>
          </TouchableOpacity>
        </View>

        {/* FILTERS CARD */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📇 Filtros</Text>
          
          <View style={styles.filterRow}>
            <View style={styles.filterInfo}>
              <Text style={styles.filterLabel}>Ignorar Contactos Salvos</Text>
              <Text style={styles.filterDescription}>
                Apenas responder a números desconhecidos
              </Text>
            </View>
            <Switch
              value={ignoreContacts}
              onValueChange={setIgnoreContacts}
              trackColor={{ false: '#444', true: '#4CAF50' }}
              thumbColor={ignoreContacts ? '#fff' : '#ccc'}
            />
          </View>

          <View style={styles.filterDivider} />

          <View style={styles.filterRow}>
            <View style={styles.filterInfo}>
              <Text style={styles.filterLabel}>🛡️ Filtro Anti-Spam (30 min)</Text>
              <Text style={styles.filterDescription}>
                Bloquear SMS repetidas ao mesmo número por 30 minutos
              </Text>
              <Text style={styles.filterNote}>
                ⚠️ Contactos VIP podem receber após apenas 10 mins
              </Text>
            </View>
            <Switch
              value={antiSpamEnabled}
              onValueChange={setAntiSpamEnabled}
              trackColor={{ false: '#444', true: '#4CAF50' }}
              thumbColor={antiSpamEnabled ? '#fff' : '#ccc'}
            />
          </View>
        </View>

        {/* BLACKLIST CARD */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🚫 Lista de Bloqueio</Text>
          <Text style={styles.filterDescription}>
            Números bloqueados nunca receberão SMS automático
          </Text>
          
          <View style={styles.blacklistInput}>
            <TextInput
              style={styles.numberInput}
              value={newNumber}
              onChangeText={setNewNumber}
              placeholder="+351 912 345 678"
              placeholderTextColor="#666"
              keyboardType="phone-pad"
            />
            <TouchableOpacity 
              style={styles.contactPickerButton} 
              onPress={() => openContactPicker('blacklist')}
            >
              <Text style={styles.contactPickerIcon}>🔍</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={handleAddToBlacklist}>
              <Text style={styles.addButtonText}>+ Adicionar</Text>
            </TouchableOpacity>
          </View>

          {blacklist.length > 0 ? (
            <View style={styles.blacklistContainer}>
              {blacklist.map((number, index) => (
                <View key={index} style={styles.blacklistItem}>
                  <Text style={styles.blacklistNumber}>{formatPhoneNumber(number)}</Text>
                  <TouchableOpacity onPress={() => handleRemoveFromBlacklist(number)}>
                    <Text style={styles.removeButton}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyBlacklist}>Nenhum número bloqueado</Text>
          )}
        </View>

        {/* VIP LIST CARD */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🌟 Contactos VIP</Text>
          <Text style={styles.filterDescription}>
            Estes números SEMPRE receberão SMS, ignorando todas as regras
          </Text>
          
          <View style={styles.blacklistInput}>
            <TextInput
              style={styles.numberInput}
              value={newVipNumber}
              onChangeText={setNewVipNumber}
              placeholder="+351 912 345 678"
              placeholderTextColor="#666"
              keyboardType="phone-pad"
            />
            <TouchableOpacity 
              style={styles.contactPickerButton} 
              onPress={() => openContactPicker('vip')}
            >
              <Text style={styles.contactPickerIcon}>🔍</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={handleAddToVIP}>
              <Text style={styles.addButtonText}>+ Adicionar</Text>
            </TouchableOpacity>
          </View>

          {vipList.length > 0 ? (
            <View style={styles.blacklistContainer}>
              {vipList.map((number, index) => (
                <View key={index} style={styles.blacklistItem}>
                  <Text style={styles.blacklistNumber}>{formatPhoneNumber(number)}</Text>
                  <TouchableOpacity onPress={() => handleRemoveFromVIP(number)}>
                    <Text style={styles.removeButton}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyBlacklist}>Nenhum contacto VIP</Text>
          )}
        </View>

        {/* SMS ACTIVITY LOG CARD */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 Histórico de Atividade</Text>
          
          <Text style={styles.filterDescription}>
            Últimas {smsLogs.length} SMS enviadas (máx. 15)
          </Text>

          {/* Status Info */}
          <View style={styles.debugInfo}>
            <Text style={styles.debugText}>
              🛡️ Anti-Spam: {antiSpamEnabled ? '✅ Ativo' : '❌ Inativo'}
            </Text>
            <Text style={styles.debugText}>
              👥 Ignorar Salvos: {ignoreContacts ? '✅ Ativo' : '❌ Inativo'}
            </Text>
          </View>

          {/* 🔄 SYNC BUTTON - Pull logs from Native Module */}
          <TouchableOpacity 
            style={[styles.testButton, { backgroundColor: '#4CAF50' }]} 
            onPress={async () => {
              try {
                console.log('🔄 Sync button pressed - pulling logs from native...');
                
                // Force sync from native module
                const logs = await syncLogsFromNative();
                
                Alert.alert(
                  '✅ Atualizado', 
                  `${logs.length} SMS encontrados no histórico.`,
                  [{ text: 'OK' }]
                );
              } catch (error) {
                console.error('❌ Sync failed:', error);
                Alert.alert('❌ Erro', 'Falha ao atualizar histórico');
              }
            }}
          >
            <Text style={styles.testButtonText}>🔄 Atualizar Histórico</Text>
          </TouchableOpacity>

          {smsLogs.length > 0 ? (
            <View style={styles.logsContainer}>
              {smsLogs.map((log, index) => {
                const date = new Date(log.timestamp);
                const timeStr = date.toLocaleTimeString('pt-PT', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                });
                
                return (
                  <View key={`${log.number}-${log.timestamp}-${index}`} style={styles.logItemCompact}>
                    <Text style={styles.logNumberCompact}>{formatPhoneNumber(log.number)}</Text>
                    <Text style={styles.logDivider}>•</Text>
                    <Text style={styles.logTimeCompact}>{timeStr}</Text>
                    <Text style={styles.logDivider}>•</Text>
                    <View style={styles.templateBadge}>
                      <Text style={styles.templateBadgeText}>{log.template}</Text>
                    </View>
                    {vipList.includes(log.number) && (
                      <View style={styles.vipBadgeCompact}>
                        <Text style={styles.vipBadgeTextCompact}>⭐</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyLogsContainer}>
              <Text style={styles.emptyLogsIcon}>📭</Text>
              <Text style={styles.emptyLogsText}>Nenhuma SMS enviada ainda</Text>
              <Text style={styles.emptyLogsSubtext}>
                Quando o serviço responder a chamadas, verá o histórico aqui
              </Text>
            </View>
          )}
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>ClientS v1.0</Text>
          <Text style={styles.footerText}>Desenvolvido para Android por David Figueiredo</Text>
          <Text style={styles.copyrightText}>© 2026 David Figueiredo. All rights reserved.</Text>
        </View>

      </ScrollView>

      {/* CONTACT PICKER MODAL */}
      <Modal
        visible={showContactModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowContactModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {contactPickerMode === 'blacklist' ? '🚫 Selecionar Contacto' : '🌟 Selecionar VIP'}
            </Text>
            <TouchableOpacity onPress={() => setShowContactModal(false)}>
              <Text style={styles.modalCloseButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={handleSearchContacts}
              placeholder="Procurar contacto..."
              placeholderTextColor="#666"
              autoFocus
            />
          </View>

          <FlatList
            data={filteredContacts}
            keyExtractor={(item, index) => `${item.number}-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.contactItem}
                onPress={() => selectContact(item)}
                activeOpacity={0.7}
              >
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{item.name}</Text>
                  <Text style={styles.contactNumber}>{item.number}</Text>
                </View>
                <Text style={styles.contactArrow}>›</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={styles.emptyContactList}>
                <Text style={styles.emptyContactText}>Nenhum contacto encontrado</Text>
              </View>
            )}
            style={styles.contactList}
          />
        </View>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  appTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 5,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  statusCard: {
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 5,
  },
  statusActive: {
    color: '#4CAF50',
  },
  statusInactive: {
    color: '#888',
  },
  messageInput: {
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    padding: 15,
    color: '#fff',
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 15,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  timeInputGroup: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 5,
  },
  timeInput: {
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    padding: 15,
    color: '#4CAF50',
    fontSize: 24,
    fontWeight: 'bold',
    width: 80,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  timeSeparator: {
    fontSize: 32,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginHorizontal: 10,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  filterInfo: {
    flex: 1,
    marginRight: 15,
  },
  filterLabel: {
    fontSize: 15,
    color: '#fff',
    marginBottom: 3,
  },
  filterDescription: {
    fontSize: 12,
    color: '#888',
    marginBottom: 15,
  },
  blacklistInput: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 10,
  },
  numberInput: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    padding: 15,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  contactPickerButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 50,
  },
  contactPickerIcon: {
    fontSize: 20,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 15,
    justifyContent: 'center',
    minWidth: 100,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  blacklistContainer: {
    marginTop: 10,
  },
  blacklistItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    padding: 15,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  blacklistNumber: {
    color: '#fff',
    fontSize: 15,
  },
  removeButton: {
    color: '#ff6b6b',
    fontSize: 20,
    fontWeight: 'bold',
    paddingHorizontal: 10,
  },
  emptyBlacklist: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  footerText: {
    fontSize: 13,
    color: '#888',
    marginBottom: 5,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 20,
  },
  lockContainer: {
    flex: 1,
    backgroundColor: '#1a0000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  lockContent: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  lockIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  lockTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff4444',
    textAlign: 'center',
    marginBottom: 30,
  },
  deviceIdCard: {
    backgroundColor: '#2a1111',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTextContent: {
    flex: 1,
    marginRight: 10,
  },
  deviceIdLabel: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 8,
  },
  deviceIdValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  instructionsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    marginBottom: 30,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
  },
  paymentTextContent: {
    flex: 1,
    marginRight: 10,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
  },
  instructionsText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 22,
    marginBottom: 10,
  },
  phoneNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 15,
    width: '100%',
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  versionContainer: {
    marginTop: 30,
    padding: 10,
  },
  versionText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  creditsContainer: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#333',
    alignItems: 'center',
  },
  creditsText: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
    marginBottom: 5,
  },
  copyrightText: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    opacity: 0.8,
  },
  copyButtonMinimal: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  copyIconMinimal: {
    fontSize: 16,
    color: '#888',
  },
  copyLabelMinimal: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
  },
  copyButtonMinimalSmall: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  copyLabelMinimalSmall: {
    fontSize: 9,
    color: '#888',
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  modalCloseButton: {
    fontSize: 28,
    color: '#ff4444',
    fontWeight: 'bold',
    paddingHorizontal: 10,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#0a0a0a',
  },
  searchInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  contactList: {
    flex: 1,
  },
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  contactNumber: {
    fontSize: 15,
    color: '#888',
  },
  contactArrow: {
    fontSize: 24,
    color: '#444',
    marginLeft: 10,
  },
  emptyContactList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyContactText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // 🆕 PRO FEATURES STYLES
  // ═══════════════════════════════════════════════════════════════════════════
  templateSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  templateSelectorButton: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#333',
    minHeight: 70,
  },
  templateSelectorButtonActive: {
    backgroundColor: '#1a3a1a',
    borderColor: '#4CAF50',
  },
  templateSelectorText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#888',
    textAlign: 'center',
  },
  templateSelectorTextActive: {
    color: '#4CAF50',
  },
  activeIndicator: {
    fontSize: 10,
    color: '#4CAF50',
    marginTop: 5,
    fontWeight: 'bold',
  },
  templateEditorContainer: {
    marginTop: 10,
  },
  templateEditorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 10,
  },
  filterDivider: {
    height: 1,
    backgroundColor: '#2a2a2a',
    marginVertical: 15,
  },
  filterNote: {
    fontSize: 11,
    color: '#ff9800',
    marginTop: 5,
    fontStyle: 'italic',
  },
  // logHeader removed - no longer needed (title is standalone)
  // clearLogsButton removed - auto-rotation handles cleanup
  logsContainer: {
    marginTop: 15,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    minHeight: 64,
  },
  logIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a3a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  logIcon: {
    fontSize: 18,
  },
  logContent: {
    flex: 1,
    marginRight: 8,
    minWidth: 0,
  },
  logNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  logTime: {
    fontSize: 12,
    color: '#888',
  },
  vipBadge: {
    backgroundColor: '#ffd700',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  vipBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
  emptyLogsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyLogsIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  emptyLogsText: {
    fontSize: 15,
    color: '#888',
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyLogsSubtext: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  // Compact single-line log styles
  logItemCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  logNumberCompact: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    flexShrink: 1,
  },
  logDivider: {
    fontSize: 12,
    color: '#444',
    marginHorizontal: 8,
  },
  logTimeCompact: {
    fontSize: 13,
    color: '#888',
  },
  templateBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  templateBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000',
  },
  vipBadgeCompact: {
    marginLeft: 6,
  },
  vipBadgeTextCompact: {
    fontSize: 14,
  },
  testButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#444',
  },
  testButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  debugInfo: {
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    padding: 10,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  debugText: {
    fontSize: 11,
    color: '#888',
    marginBottom: 3,
    fontFamily: 'monospace',
  },
});

