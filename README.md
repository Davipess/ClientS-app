# 📲 ClientS Pro — Resilient Call Response & Messaging Automation

> A hybrid mobile utility for Android designed to capture missed calls and automatically deliver templated SMS responses, engineered to overcome mobile background execution constraints.

---

## 💡 Why I Built This
Independent professionals and service providers frequently miss incoming phone calls while working with clients, resulting in lost leads and frustrated customers.

The objective of **ClientS Pro** was to establish an automated, reliable safety net: as soon as an incoming call is missed, the device immediately dispatches a customized, helpful SMS response to the caller.

---

## ⚙️ The Technical Challenge: Surviving Android Background Restrictions
In initial experiments using cross-platform JavaScript (React Native), the automation repeatedly failed whenever the phone's screen was locked or placed into battery-saving mode (Doze Mode). Under modern Android lifecycle constraints, the operating system aggressively suspends the JavaScript runtime, killing background timers and breaking React Native event emitters.

### How I Solved It:
1. **Native Kotlin Engine:** Moved the core telephony listener (`CallKeeperService.kt`) directly into a native Android module.
2. **Shared Native Storage:** Used Android's native `SharedPreferences` as the **Single Source of Truth**. Even when the UI process is entirely inactive, the native service checks anti-spam cooldown intervals (e.g., 30-minute window) and logs sent SMS records atomically.
3. **Resilient Foreground Sync:** When the user opens the React Native application, an event listener syncs the native log entries into the UI smoothly.

---

## 🏗️ Architecture Overview

```
[ Incoming Call Missed ]
           │
           ▼
[ Android Native Service (Kotlin) ]
   ├── 1. Rule Evaluation (Master toggle / VIP whitelist / Blacklist)
   ├── 2. Anti-Spam Check ◄── [ SharedPreferences (Native Storage) ]
   │      (Drops event if sent within cooldown window)
   ├── 3. Native SMS Dispatch ──► [ Android SmsManager ]
   └── 4. Atomic Record Write ──► [ SharedPreferences ]
           │
           │ (On App Resume)
           ▼
[ React Native UI (TypeScript) ] ──► Syncs & Displays History
```

---

## 🛠️ Stack & Technologies
* **Native Android Core:** Kotlin, Android Telephony APIs, SharedPreferences
* **Cross-Platform UI:** React Native, TypeScript
* **Cloud & Data Sync:** Supabase (PostgreSQL)

---

## 🤖 Development & Engineering Approach
* **My Role:** Diagnosed the root cause of background failures on mobile OSs, designed the shared-storage architecture, and established the operational logic (anti-spam cadence and permission boundaries).
* **AI Collaboration:** Leveraged AI tools to accelerate the implementation of Kotlin services and React Native screens, using problem-solving and documentation analysis to test and validate real device behavior.

---

<details>
<summary><b>🇵🇹 Versão em Português</b></summary>

### 📲 ClientS Pro — Automação de Chamadas e Resposta SMS em Segundo Plano
Aplicação móvel híbrida para Android concebida para capturar chamadas perdidas e responder de forma instantânea e personalizada por SMS.

* **Desafio Superado:** O sistema operativo Android suspende a execução de código JavaScript quando o ecrã bloqueia ou a app vai para segundo plano. A solução passou por migrar o motor de eventos telefónicos para um serviço nativo em Kotlin e adotar `SharedPreferences` como fonte única da verdade para controlo de anti-spam (janela de 30 minutos) e histórico.
* **Metodologia:** Condução do diagnóstico de ciclo de vida móvel e desenho da solução de persistência nativa, acelerando a escrita do código através de ferramentas de IA.
</details>
