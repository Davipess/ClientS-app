# 🏗️ System Architecture — ClientS Pro (Native Shared Storage)

## 📐 Solution Overview
This document specifies the technical architecture engineered to solve background telephony event interception, resilient activity logging, and anti-spam rate limiting in ClientS Pro.

---

## 🔧 The Architectural Challenge

### ❌ The Breakdown of Traditional Hybrid Mobile Approaches:
1. **Empty Activity History:** SMS dispatched while the device was locked or in background did not reflect in the UI.
2. **Anti-Spam Bypass:** In-memory timers failed to prevent duplicate dispatches during rapid repeated calls.
3. **Broken React Native Bridge:** Operating system battery optimizers (Doze Mode, AppStandby) suspend the JavaScript engine, breaking React Native event emitters and asynchronous queues.

### ✅ Root Cause & Design Principle:
* **Core Limitation:** JavaScript execution cannot be guaranteed when an Android application process is suspended in the background.
* **Architectural Fix:** Decouple event processing from the JavaScript runtime by establishing **Android Native `SharedPreferences` as the Single Source of Truth**. The native layer executes the entire business loop independently, while the React Native UI functions as an observer that reconciles state upon resume.

---

## 🏛️ Shared Storage Architecture

### 📊 End-to-End Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    NATIVE MODULE (Kotlin)                   │
│                  CallKeeperService.kt                       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Missed Call Event Detected → scheduleSMS()        │  │
│  │                                                       │  │
│  │ 2. Pipeline Validations:                             │  │
│  │    ✓ Master Switch Check                             │  │
│  │    ✓ VIP Whitelist (Bypasses cooldown)               │  │
│  │    ✓ Blacklist Filter                                │  │
│  │    ✓ Contact Book Rules                              │  │
│  │    ✓ Anti-Spam Check (30 min) ◄── READ SharedPrefs   │  │
│  │                                                       │  │
│  │ 3. SMS Dispatch via SMSHandler.sendSMS()             │  │
│  │                                                       │  │
│  │ 4. logSmsToSharedPrefs() ──► WRITE SharedPrefs       │  │
│  │    - Serialization: timestamp|phone_number|template   │  │
│  │    - Key: "clients_logs" → "sms_history"            │  │
│  │                                                       │  │
│  │ 5. Persist Anti-Spam Cooldown Timestamp              │  │
│  │    - Key: "last_sent_+351912345678"                 │  │
│  │    - Value: System.currentTimeMillis()              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕️
                    SharedPreferences
                  (Native Atomic Storage)
                            ↕️
┌─────────────────────────────────────────────────────────────┐
│               REACT NATIVE LAYER (TypeScript)               │
│                      App.tsx                                │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Application Mount / Resume                        │  │
│  │    ↓                                                 │  │
│  │ 2. AppState Listener detects "active" state          │  │
│  │    ↓                                                 │  │
│  │ 3. syncLogsFromNative() Triggered                    │  │
│  │    ↓                                                 │  │
│  │ 4. CallKeeper.getSmsHistory() ◄── READ SharedPrefs   │  │
│  │    ↓                                                 │  │
│  │ 5. Parse Pipe-Delimited Log Stream                   │  │
│  │    timestamp|number|template → SmsLog[]             │  │
│  │    ↓                                                 │  │
│  │ 6. setSmsLogs(parsedLogs) → Render State Update      │  │
│  │    ↓                                                 │  │
│  │ 7. UI displays "Activity History" Card:              │  │
│  │    - Formatted Number: +351 912 345 678             │  │
│  │    - Template: A, B, or C                           │  │
│  │    - Relative Timestamp: "2 min ago"                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ SETTINGS SYNCHRONIZATION (App → Native Layer)        │  │
│  │                                                       │  │
│  │ • Anti-Spam Toggle State                             │  │
│  │   App.tsx → CallKeeper.setAntiSpamEnabled()         │  │
│  │                                                       │  │
│  │ • Active Message Template Index (A/B/C)              │  │
│  │   App.tsx → CallKeeper.setActiveTemplateIndex()     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Implementation Details

### 1️⃣ Native Android Core (Kotlin)

#### **`CallKeeperService.kt`**
Handles background evaluation and SMS dispatch directly from telephony broadcast events:
```kotlin
// Step 1: Evaluate Anti-Spam Cooldown Window
val antiSpamEnabled = prefs.getBoolean("@CallKeeper:antiSpamEnabled", false)
if (antiSpamEnabled) {
  val lastSentTimestamp = prefs.getLong("last_sent_$normalizedPhone", 0L)
  val timeDiff = System.currentTimeMillis() - lastSentTimestamp
  val thirtyMinutes = 30 * 60 * 1000L
  
  if (timeDiff < thirtyMinutes) {
    // ⏱️ Cooldown active: Drop event to prevent spamming
    return@postDelayed
  }
}

// Step 2: Atomic Activity Logging
val templateIndex = prefs.getInt("@CallKeeper:activeTemplateIndex", 0)
logSmsToSharedPrefs(normalizedPhone, templateIndex)

// Step 3: Persist Cooldown Timestamp
val editor = prefs.edit()
editor.putLong("last_sent_$normalizedPhone", System.currentTimeMillis())
editor.apply()

// Step 4: Storage Serialization Helper
private fun logSmsToSharedPrefs(phoneNumber: String, templateIndex: Int) {
  val sharedPrefs = applicationContext.getSharedPreferences("clients_logs", Context.MODE_PRIVATE)
  val editor = sharedPrefs.edit()
  
  val template = when(templateIndex) { 0 -> "A"; 1 -> "B"; 2 -> "C"; else -> "A" }
  val timestamp = System.currentTimeMillis()
  val logEntry = "$timestamp|$phoneNumber|$template"
  
  val currentLogs = sharedPrefs.getString("sms_history", "") ?: ""
  val newLogs = if (currentLogs.isEmpty()) logEntry else "$logEntry\n$currentLogs"
  val boundedLines = newLogs.split("\n").take(100).joinToString("\n")
  
  editor.putString("sms_history", boundedLines)
  editor.apply()
}
```

#### **`CallKeeperModule.kt`**
Exposes typed bridge interfaces to read shared storage and sync configuration from React Native:
```kotlin
Function("getSmsHistory") {
  val context = appContext.reactContext ?: return@Function ""
  val prefs = context.getSharedPreferences("clients_logs", Context.MODE_PRIVATE)
  return@Function prefs.getString("sms_history", "") ?: ""
}

Function("setAntiSpamEnabled") { enabled: Boolean ->
  val prefs = context.getSharedPreferences("CallKeeperPrefs", Context.MODE_PRIVATE)
  prefs.edit().putBoolean("@CallKeeper:antiSpamEnabled", enabled).apply()
  return@Function true
}

Function("setActiveTemplateIndex") { index: Int ->
  val prefs = context.getSharedPreferences("CallKeeperPrefs", Context.MODE_PRIVATE)
  prefs.edit().putInt("@CallKeeper:activeTemplateIndex", index).apply()
  return@Function true
}
```

---

### 2️⃣ Reactive UI Layer (TypeScript / React Native)

#### **`App.tsx`**
Syncs background history when returning to the foreground and synchronizes user preferences:
```typescript
// Reconciles native logs into application state
const syncLogsFromNative = async () => {
  const nativeHistoryString = await CallKeeper.getSmsHistory();
  
  if (nativeHistoryString && nativeHistoryString.trim() !== '') {
    const lines = nativeHistoryString.split('\n').filter((line: string) => line.trim() !== '');
    const parsedLogs: SmsLog[] = [];
    
    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length === 3) {
        const [timestampStr, number, template] = parts;
        parsedLogs.push({
          number: number.trim(),
          timestamp: parseInt(timestampStr, 10),
          template: template.trim() as 'A' | 'B' | 'C'
        });
      }
    }
    
    const sortedLogs = parsedLogs.sort((a, b) => b.timestamp - a.timestamp).slice(0, 15);
    setSmsLogs(sortedLogs);
  }
};

// Lifecycle listener: Auto-sync on resume
useEffect(() => {
  syncLogsFromNative();
  
  const subscription = Platform.OS === 'android' ? 
    AppState.addEventListener('change', (state: string) => {
      if (state === 'active') {
        syncLogsFromNative();
      }
    }) : null;
  
  return () => subscription?.remove();
}, []);
```

---

## 🔄 End-to-End Execution Scenarios

### Scenario A: Background Call & Cooldown (Screen Off)
1. **Missed Call Received:** Telephony broadcast triggers `CallReceiver`.
2. **Background Execution:** `CallKeeperService` spins up independently from React Native.
3. **Anti-Spam Evaluation:** Inspects `last_sent_+351912345678` in `SharedPreferences`.
   * If `elapsed < 30 minutes`: Drops SMS and exits cleanly.
   * If `elapsed >= 30 minutes`: Dispatches templated SMS through Android `SmsManager`.
4. **Atomic Storage Update:** Appends log entry and refreshes last-sent timestamp.

### Scenario B: Application Launch & Reconciliation
1. **User opens ClientS:** `AppState` transitions from `background` to `active`.
2. **Bridge Invocation:** Calls `CallKeeper.getSmsHistory()`.
3. **Stream Parsing:** Transforms serialized pipe entries into UI state arrays.
4. **UI Render:** Activity log displays normalized numbers, template markers, and relative timestamps without dropping any background events.

---

<details>
<summary><b>🇵🇹 Versão em Português</b></summary>

### 🏗️ Arquitetura Final — ClientS Pro (Armazenamento Nativo Partilhado)

#### 📐 Visão Geral da Solução
Este documento descreve a arquitetura concebida para resolver os constrangimentos de execução em segundo plano, registo de atividade e controlo de anti-spam no ClientS Pro.

#### 🔧 Desafio Identificado
* **Problema:** O React Native não garante a execução de código JavaScript quando a aplicação está em segundo plano ou o ecrã está bloqueado (Doze Mode do Android). Event emitters e temporizadores em JS falham.
* **Solução:** Utilização do `SharedPreferences` nativo do Android como **Fonte Única da Verdade**. O serviço nativo em Kotlin (`CallKeeperService.kt`) processa todo o pipeline de interceção, validação e envio de SMS de forma autónoma.

#### 🔄 Fluxo de Dados
1. **Chamada Perdida:** O serviço nativo interceta o evento telefónico.
2. **Validações:** Verifica Master Switch, Whitelist VIP, Blacklist e cooldown de 30 minutos em `SharedPreferences`.
3. **Envio:** Dispara SMS via `SmsManager` e regista o log atómico em `SharedPreferences` (`timestamp|número|template`).
4. **Sincronização:** Quando a aplicação React Native é reaberta, o listener de `AppState` lê o histórico nativo e atualiza a interface gráfica.
</details>
