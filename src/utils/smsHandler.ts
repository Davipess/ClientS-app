import * as SMS from 'expo-sms';
import { Alert } from 'react-native';

/**
 * Verifica se o dispositivo suporta envio de SMS
 */
export const isSmsAvailable = async (): Promise<boolean> => {
  try {
    return await SMS.isAvailableAsync();
  } catch (error) {
    console.error('Erro ao verificar disponibilidade de SMS:', error);
    return false;
  }
};

/**
 * Envia um SMS automático para um número
 * NOTA: No Android, isto abre a app de mensagens com a mensagem pré-preenchida
 * O utilizador terá que pressionar "Enviar" manualmente
 * 
 * @param phoneNumber - Número de telefone (com código de país se necessário)
 * @param message - Mensagem a enviar
 * @returns Promise<boolean> - true se o SMS foi preparado, false se falhou
 */
export const sendAutoSms = async (
  phoneNumber: string, 
  message: string
): Promise<boolean> => {
  try {
    // Verifica se SMS está disponível
    const isAvailable = await isSmsAvailable();
    
    if (!isAvailable) {
      Alert.alert(
        'SMS Indisponível',
        'Este dispositivo não suporta envio de SMS.'
      );
      return false;
    }

    // Prepara e abre a app de SMS
    await SMS.sendSMSAsync([phoneNumber], message);
    
    console.log(`SMS preparado para: ${phoneNumber}`);
    return true;
    
  } catch (error) {
    console.error('Erro ao enviar SMS:', error);
    Alert.alert(
      'Erro ao Enviar SMS',
      'Ocorreu um erro ao preparar a mensagem. Por favor, tente novamente.'
    );
    return false;
  }
};

/**
 * Envia SMS para múltiplos números
 * @param phoneNumbers - Array de números de telefone
 * @param message - Mensagem a enviar
 */
export const sendBulkSms = async (
  phoneNumbers: string[], 
  message: string
): Promise<boolean> => {
  try {
    const isAvailable = await isSmsAvailable();
    
    if (!isAvailable) {
      Alert.alert(
        'SMS Indisponível',
        'Este dispositivo não suporta envio de SMS.'
      );
      return false;
    }

    await SMS.sendSMSAsync(phoneNumbers, message);
    
    console.log(`SMS preparado para ${phoneNumbers.length} números`);
    return true;
    
  } catch (error) {
    console.error('Erro ao enviar SMS em lote:', error);
    return false;
  }
};

/**
 * Formata o número de telefone para formato internacional
 * Remove espaços e caracteres especiais
 */
export const formatPhoneNumber = (phoneNumber: string): string => {
  // Remove tudo exceto números e o sinal +
  return phoneNumber.replace(/[^\d+]/g, '');
};

/**
 * Valida se um número de telefone é válido
 * Aceita formatos: +351912345678, 912345678, etc
 */
export const isValidPhoneNumber = (phoneNumber: string): boolean => {
  const formatted = formatPhoneNumber(phoneNumber);
  
  // Número deve ter pelo menos 9 dígitos
  const digitsOnly = formatted.replace(/\+/g, '');
  return digitsOnly.length >= 9 && digitsOnly.length <= 15;
};
