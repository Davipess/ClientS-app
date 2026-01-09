import { Alert, Linking, Platform, PermissionsAndroid } from 'react-native';

/**
 * Lista de todas as permissões necessárias para o ResgatePro funcionar
 */
const REQUIRED_PERMISSIONS = Platform.select({
  android: [
    PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
    PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
    PermissionsAndroid.PERMISSIONS.SEND_SMS,
    PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
  ],
  default: [],
});

/**
 * Verifica se todas as permissões necessárias foram concedidas
 */
export const checkAllPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const results = await Promise.all(
      REQUIRED_PERMISSIONS.map(permission => 
        PermissionsAndroid.check(permission)
      )
    );
    
    // Retorna true apenas se TODAS as permissões estiverem concedidas
    return results.every(result => result === true);
  } catch (error) {
    console.error('Erro ao verificar permissões:', error);
    return false;
  }
};

/**
 * Solicita todas as permissões necessárias ao utilizador
 * Retorna true se todas foram concedidas, false caso contrário
 */
export const requestAllPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const results = await PermissionsAndroid.requestMultiple(
      REQUIRED_PERMISSIONS
    );
    
    // Verifica se todas foram concedidas
    const allGranted = Object.values(results).every(
      result => result === PermissionsAndroid.RESULTS.GRANTED
    );
    
    if (!allGranted) {
      // Mostra alerta se alguma permissão foi negada
      showPermissionDeniedAlert();
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao solicitar permissões:', error);
    Alert.alert(
      'Erro',
      'Ocorreu um erro ao solicitar permissões. Por favor, tente novamente.'
    );
    return false;
  }
};

/**
 * Mostra alerta quando permissões são negadas
 * Oferece opção de abrir as configurações do sistema
 */
const showPermissionDeniedAlert = () => {
  Alert.alert(
    'Permissões Necessárias',
    'O ResgatePro precisa de acesso ao telefone, chamadas, SMS e contactos para funcionar corretamente.\n\nSem estas permissões, a app não conseguirá enviar mensagens automáticas.',
    [
      {
        text: 'Cancelar',
        style: 'cancel',
      },
      {
        text: 'Abrir Configurações',
        onPress: () => Linking.openSettings(),
      },
    ]
  );
};

/**
 * Verifica o estado individual de uma permissão específica
 */
export const checkPermission = async (permission: string): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    return await PermissionsAndroid.check(permission as any);
  } catch (error) {
    console.error(`Erro ao verificar permissão ${permission}:`, error);
    return false;
  }
};

/**
 * Solicita uma permissão específica
 */
export const requestPermission = async (permission: string): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const result = await PermissionsAndroid.request(permission as any);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    console.error(`Erro ao solicitar permissão ${permission}:`, error);
    return false;
  }
};

/**
 * Retorna informações sobre as permissões em formato legível
 */
export const getPermissionsStatus = async () => {
  if (Platform.OS !== 'android') {
    return [];
  }

  const permissionNames: Record<string, string> = {
    [PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE]: 'Estado do Telefone',
    [PermissionsAndroid.PERMISSIONS.READ_CALL_LOG]: 'Registo de Chamadas',
    [PermissionsAndroid.PERMISSIONS.SEND_SMS]: 'Enviar SMS',
    [PermissionsAndroid.PERMISSIONS.READ_CONTACTS]: 'Ler Contactos',
  };
  
  const statuses = await Promise.all(
    REQUIRED_PERMISSIONS.map(async (permission) => {
      const granted = await PermissionsAndroid.check(permission);
      return {
        permission: permissionNames[permission] || permission,
        granted: granted,
      };
    })
  );
  
  return statuses;
};
