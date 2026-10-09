# 🔗 Native Module Integration Guide — ClientS Pro

## 🎯 Overview
This guide documents the integration between the custom Android native module (`expo-call-keeper`) and the React Native application layer. The native bridge ensures that incoming telephony events, automated SMS dispatches, and activity logs remain 100% resilient even when the user interface is completely closed or the device is locked.

---

## ⚙️ How It Operates

### 1. **Native Telephony Event Processing**
* When an incoming call transitions to a missed call state:
  * The native `CallKeeperService` catches the broadcast intent.
  * Checks configuration flags (Master Switch, VIP priority, Blacklist, Anti-Spam cooldown).
  * Automatically dispatches the templated SMS via Android's `SmsManager`.
  * **Persists Activity Log:** Writes an atomic record to Android `SharedPreferences` containing `number`, `timestamp`, and `template` (A/B/C).
  * Runs entirely at the operating system level without requiring active JavaScript execution.

### 2. **React Native State Synchronization**
* When the user opens the application or brings it to the foreground:
  * The `AppState` listener triggers an automatic reconciliation pass.
  * Reads the serialized history from native `SharedPreferences`.
  * Merges new entries with existing local application state, eliminating duplicates and sorting chronologically.
  * Renders recent dispatch events on the home dashboard.

---

## 🔧 Native Implementation Reference

### Source Location
`modules/expo-call-keeper/android/src/main/java/expo/modules/callkeeper/`

### Key Modules:
* **`CallKeeperService.kt`:** Background execution service, telephony state listeners, cooldown verification, and atomic logging.
* **`SMSHandler.kt`:** Wraps Android `SmsManager` with permission validation and safe dispatch handlers.
* **`CallKeeperModule.kt`:** Expo module exposing native methods (`getSmsHistory`, `setAntiSpamEnabled`, `setActiveTemplateIndex`) to the React Native runtime.

---

## 🧪 Device Verification & Testing Guide

To test background execution on a physical Android device or emulator with ADB:

### Test 1: Background SMS Dispatch
1. Open ClientS Pro and ensure the **Master Switch** is enabled.
2. Force-close or swipe away the application from the Android recent apps switcher.
3. Simulate an incoming call and let it ring until it drops (missed call).
4. Verify that the SMS is delivered and the device logs indicate successful background handling:
   ```bash
   adb logcat -s CallKeeper:D SMSHandler:I
   ```

### Test 2: Anti-Spam Cooldown Verification
1. Place a second call from the same number within 2 minutes.
2. Confirm via logs that the event was dropped due to active cooldown:
   ```
   D CallKeeper: ⏱️ Anti-spam active for +351...: 120s < 1800s. Skipping dispatch.
   ```

### Test 3: Foreground State Reconciliation
1. Re-open ClientS Pro.
2. Confirm the Activity History immediately shows the newly logged background interaction.

---

<details>
<summary><b>🇵🇹 Versão em Português</b></summary>

### 🔗 Guia de Integração do Módulo Nativo — ClientS Pro

#### 🎯 Visão Geral
Este guia documenta a integração entre o módulo nativo Android (`expo-call-keeper`) e a camada React Native. A arquitetura garante que eventos telefónicos, envio de SMS e registos de atividade funcionam de forma fiável mesmo com o telemóvel bloqueado ou a aplicação fechada.

#### ⚙️ Mecanismo de Funcionamento
1. **Processamento Nativo em Segundo Plano:**
   * O serviço `CallKeeperService` interceta chamadas perdidas via broadcast intents.
   * Valida regras de negócio (Master Switch, VIP, Blacklist, Anti-Spam de 30 minutos).
   * Envia o SMS via `SmsManager` e regista o log atómico em `SharedPreferences`.
2. **Sincronização com React Native:**
   * Ao abrir a app ou regressar a primeiro plano (`AppState = active`), a interface lê os registos do `SharedPreferences` nativo.
   * Mescla os dados, elimina duplicados e apresenta o histórico atualizado ao utilizador.

#### 🧪 Verificação no Dispositivo Físico
* É possível acompanhar o fluxo em tempo real através do ADB:
  ```bash
  adb logcat -s CallKeeper:D SMSHandler:I
  ```
</details>
