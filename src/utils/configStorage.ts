import AsyncStorage from '@react-native-async-storage/async-storage';

// Chaves de armazenamento
const STORAGE_KEYS = {
  SERVICE_ACTIVE: '@CallKeeper:serviceActive',
  AUTO_MESSAGE: '@CallKeeper:autoMessage',
  DELAY_MINUTES: '@CallKeeper:delayMinutes',
  IGNORE_CONTACTS: '@CallKeeper:ignoreContacts',
  BLACKLIST: '@CallKeeper:blacklist',
  VIP_LIST: '@CallKeeper:vipList',
};

// Configurações padrão
export const DEFAULT_MESSAGE = 'Olá! Não consigo atender agora. Ligo-lhe assim que possível.';
export const DEFAULT_DELAY = 2; // minutos

/**
 * Guarda o estado do serviço (Ativo/Pausado)
 */
export const saveServiceState = async (isActive: boolean): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SERVICE_ACTIVE, JSON.stringify(isActive));
    return true;
  } catch (error) {
    console.error('Erro ao guardar estado do serviço:', error);
    return false;
  }
};

/**
 * Obtém o estado do serviço
 */
export const getServiceState = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.SERVICE_ACTIVE);
    return value ? JSON.parse(value) : false;
  } catch (error) {
    console.error('Erro ao obter estado do serviço:', error);
    return false;
  }
};

/**
 * Guarda a mensagem automática
 */
export const saveAutoMessage = async (message: string): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.AUTO_MESSAGE, message);
    return true;
  } catch (error) {
    console.error('Erro ao guardar mensagem:', error);
    return false;
  }
};

/**
 * Obtém a mensagem automática
 */
export const getAutoMessage = async (): Promise<string> => {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.AUTO_MESSAGE);
    return value || DEFAULT_MESSAGE;
  } catch (error) {
    console.error('Erro ao obter mensagem:', error);
    return DEFAULT_MESSAGE;
  }
};

/**
 * Guarda o tempo de espera (delay)
 */
export const saveDelay = async (minutes: number): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.DELAY_MINUTES, JSON.stringify(minutes));
    return true;
  } catch (error) {
    console.error('Erro ao guardar delay:', error);
    return false;
  }
};

/**
 * Obtém o tempo de espera
 */
export const getDelay = async (): Promise<number> => {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.DELAY_MINUTES);
    return value ? JSON.parse(value) : DEFAULT_DELAY;
  } catch (error) {
    console.error('Erro ao obter delay:', error);
    return DEFAULT_DELAY;
  }
};

/**
 * Guarda a opção de ignorar contactos
 */
export const saveIgnoreContacts = async (ignore: boolean): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.IGNORE_CONTACTS, JSON.stringify(ignore));
    return true;
  } catch (error) {
    console.error('Erro ao guardar opção de ignorar contactos:', error);
    return false;
  }
};

/**
 * Obtém a opção de ignorar contactos
 */
export const getIgnoreContacts = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.IGNORE_CONTACTS);
    return value ? JSON.parse(value) : true; // Por padrão, ignora contactos
  } catch (error) {
    console.error('Erro ao obter opção de ignorar contactos:', error);
    return true;
  }
};

/**
 * Guarda a lista negra de números
 */
export const saveBlacklist = async (numbers: string[]): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.BLACKLIST, JSON.stringify(numbers));
    return true;
  } catch (error) {
    console.error('Erro ao guardar lista negra:', error);
    return false;
  }
};

/**
 * Obtém a lista negra de números
 */
export const getBlacklist = async (): Promise<string[]> => {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.BLACKLIST);
    return value ? JSON.parse(value) : [];
  } catch (error) {
    console.error('Erro ao obter lista negra:', error);
    return [];
  }
};

/**
 * Adiciona um número à lista negra
 */
export const addToBlacklist = async (phoneNumber: string): Promise<boolean> => {
  try {
    const blacklist = await getBlacklist();
    if (!blacklist.includes(phoneNumber)) {
      blacklist.push(phoneNumber);
      return await saveBlacklist(blacklist);
    }
    return true;
  } catch (error) {
    console.error('Erro ao adicionar à lista negra:', error);
    return false;
  }
};

/**
 * Remove um número da lista negra
 */
export const removeFromBlacklist = async (phoneNumber: string): Promise<boolean> => {
  try {
    const blacklist = await getBlacklist();
    const updated = blacklist.filter(num => num !== phoneNumber);
    return await saveBlacklist(updated);
  } catch (error) {
    console.error('Erro ao remover da lista negra:', error);
    return false;
  }
};

/**
 * Guarda a lista VIP
 */
export const saveVipList = async (vipList: string[]): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.VIP_LIST, JSON.stringify(vipList));
    return true;
  } catch (error) {
    console.error('Erro ao guardar lista VIP:', error);
    return false;
  }
};

/**
 * Obtém a lista VIP
 */
export const getVipList = async (): Promise<string[]> => {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.VIP_LIST);
    return value ? JSON.parse(value) : [];
  } catch (error) {
    console.error('Erro ao obter lista VIP:', error);
    return [];
  }
};

/**
 * Adiciona um número à lista VIP
 */
export const addToVipList = async (phoneNumber: string): Promise<boolean> => {
  try {
    const vipList = await getVipList();
    if (!vipList.includes(phoneNumber)) {
      vipList.push(phoneNumber);
      return await saveVipList(vipList);
    }
    return true;
  } catch (error) {
    console.error('Erro ao adicionar à lista VIP:', error);
    return false;
  }
};

/**
 * Remove um número da lista VIP
 */
export const removeFromVipList = async (phoneNumber: string): Promise<boolean> => {
  try {
    const vipList = await getVipList();
    const updated = vipList.filter(num => num !== phoneNumber);
    return await saveVipList(updated);
  } catch (error) {
    console.error('Erro ao remover da lista VIP:', error);
    return false;
  }
};

/**
 * Carrega todas as configurações de uma vez
 */
export const loadAllSettings = async () => {
  const [serviceActive, autoMessage, delay, ignoreContacts, blacklist, vipList] = await Promise.all([
    getServiceState(),
    getAutoMessage(),
    getDelay(),
    getIgnoreContacts(),
    getBlacklist(),
    getVipList(),
  ]);

  return {
    serviceActive,
    autoMessage,
    delay,
    ignoreContacts,
    blacklist,
    vipList,
  };
};
