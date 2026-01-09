import { requireNativeModule } from 'expo-modules-core';

const CallKeeperModule = requireNativeModule('CallKeeper');

/**
 * Inicia o serviço de monitorização de chamadas
 * @param message - Mensagem automática a enviar
 * @param delayMinutes - Tempo de espera em minutos antes de enviar
 * @returns true se o serviço foi iniciado com sucesso
 */
export function startService(message: string, delayMinutes: number): boolean {
  return CallKeeperModule.startService(message, delayMinutes);
}

/**
 * Para o serviço de monitorização
 * @returns true se o serviço foi parado com sucesso
 */
export function stopService(): boolean {
  return CallKeeperModule.stopService();
}

/**
 * Envia um SMS manualmente
 * @param phoneNumber - Número de telefone
 * @param message - Mensagem a enviar
 * @returns true se o SMS foi enviado com sucesso
 */
export function sendSMS(phoneNumber: string, message: string): boolean {
  return CallKeeperModule.sendSMS(phoneNumber, message);
}

/**
 * Verifica se o serviço está ativo
 * @returns true se o serviço está em execução
 */
export function isServiceRunning(): boolean {
  return CallKeeperModule.isServiceRunning();
}

/**
 * Define se deve ignorar contactos salvos
 * @param ignore - true para ignorar contactos salvos
 * @returns true se a configuração foi salva com sucesso
 */
export function setIgnoreContacts(ignore: boolean): boolean {
  return CallKeeperModule.setIgnoreContacts(ignore);
}

/**
 * Define a lista de números bloqueados
 * @param numbers - Array de números a bloquear
 * @returns true se a blacklist foi salva com sucesso
 */
export function setBlacklist(numbers: string[]): boolean {
  return CallKeeperModule.setBlacklist(numbers);
}

/**
 * Obtém a lista de números bloqueados
 * @returns Array de números bloqueados
 */
export function getBlacklist(): string[] {
  return CallKeeperModule.getBlacklist();
}

/**
 * Define a lista de números VIP (prioridade absoluta)
 * @param numbers - Array de números VIP
 * @returns true se a VIP list foi salva com sucesso
 */
export function setVipList(numbers: string[]): boolean {
  return CallKeeperModule.setVipList(numbers);
}

/**
 * Obtém a lista de números VIP
 * @returns Array de números VIP
 */
export function getVipList(): string[] {
  return CallKeeperModule.getVipList();
}

/**
 * Obtém o histórico de SMS enviados (formato: timestamp|número|template)
 * @returns String com histórico separado por newlines
 */
export function getSmsHistory(): string {
  return CallKeeperModule.getSmsHistory();
}

/**
 * Define se o filtro anti-spam (30 minutos) está ativo
 * @param enabled - true para ativar, false para desativar
 * @returns true se foi salvo com sucesso
 */
export function setAntiSpamEnabled(enabled: boolean): boolean {
  return CallKeeperModule.setAntiSpamEnabled(enabled);
}

/**
 * Obtém o estado do filtro anti-spam
 * @returns true se o anti-spam está ativo
 */
export function getAntiSpamEnabled(): boolean {
  return CallKeeperModule.getAntiSpamEnabled();
}

/**
 * Define o índice do template ativo (0=A, 1=B, 2=C)
 * @param index - Índice do template (0, 1 ou 2)
 * @returns true se foi salvo com sucesso
 */
export function setActiveTemplateIndex(index: number): boolean {
  return CallKeeperModule.setActiveTemplateIndex(index);
}

export default {
  startService,
  stopService,
  sendSMS,
  isServiceRunning,
  setIgnoreContacts,
  setBlacklist,
  getBlacklist,
  setVipList,
  getVipList,
  getSmsHistory,
  setAntiSpamEnabled,
  getAntiSpamEnabled,
  setActiveTemplateIndex,
};
