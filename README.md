# 📲 ClientS Pro: Resilient Call Response & Messaging Automation

<p align="left">
  <a href="https://developer.android.com/"><img src="https://img.shields.io/badge/Platform-Android-3DDC84?style=flat&logo=android&logoColor=white" alt="Android"></a>
  <a href="https://kotlinlang.org/"><img src="https://img.shields.io/badge/Native-Kotlin-7F52FF?style=flat&logo=kotlin&logoColor=white" alt="Kotlin"></a>
  <a href="https://reactnative.dev/"><img src="https://img.shields.io/badge/UI-React_Native-61DAFB?style=flat&logo=react&logoColor=black" alt="React Native"></a>
  <a href="https://expo.dev/"><img src="https://img.shields.io/badge/Framework-Expo-000020?style=flat&logo=expo&logoColor=white" alt="Expo"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Licensing-Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white" alt="Supabase"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-green.svg?style=flat" alt="MIT License"></a>
</p>

> A hybrid mobile utility for Android designed to capture missed calls and automatically deliver templated SMS responses, engineered to overcome mobile background execution constraints.

---

## 📑 Table of Contents
* [💡 Why I Built This](#-why-i-built-this)
* [⚙️ The Technical Challenge: Surviving Android Background Restrictions](#️-the-technical-challenge-surviving-android-background-restrictions)
* [🏗️ Architecture Overview](#️-architecture-overview)
* [🛠️ Stack & Technologies](#️-stack--technologies)
* [🤖 Development & Engineering Approach](#-development--engineering-approach)
* [💡 Lessons Learned & Engineering Takeaways](#-lessons-learned--engineering-takeaways)
* [🧪 Testing & Hardware Verification](#-testing--hardware-verification)
* [📚 Detailed Documentation](#-detailed-documentation)
* [🇵🇹 Versão em Português](#-versão-em-português)

---

## 💡 Why I Built This
Independent professionals and service providers frequently miss incoming phone calls while working with clients, resulting in lost leads who turn to competitors.

The original ambition was to build a full-scale commercial software service. However, integrating complex direct in-app payment processors proved overly burdensome for an early project. I pivoted towards a pragmatic, lightweight model:
1. **On-Device Automation:** An Android application installed directly on the user's smartphone that automatically intercepts missed calls and immediately delivers tailored SMS replies.
2. **Remote Subscription Licensing:** A lightweight verification receiver built on Supabase. Customers pay monthly off-platform (e.g., via bank transfer / MB WAY), and the app verifies active license status against their device identifier to unlock functionality.

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
           |
           v
[ Android Native Service (Kotlin) ]
   +--> 1. Rule Evaluation (Master toggle / VIP whitelist / Blacklist)
   +--> 2. Anti-Spam Check <--- [ SharedPreferences (Native Storage) ]
   |      (Drops event if sent within cooldown window)
   +--> 3. Native SMS Dispatch ---> [ Android SmsManager ]
   +--> 4. Atomic Record Write ---> [ SharedPreferences ]
           |
           | (On App Resume)
           v
[ React Native UI (TypeScript) ] ---> Syncs & Displays History
```

---

## 🛠️ Stack & Technologies

| Layer | Technologies | Role in System |
|---|---|---|
| **Native Android Core** | Kotlin, Android Telephony APIs, BroadcastReceiver | Autonomous background call interception and SMS dispatching |
| **Shared Persistence** | Android `SharedPreferences` | Single Source of Truth for cooldowns, logs, and user configuration |
| **Mobile UI** | React Native, Expo, TypeScript | Clean dashboard for rule toggling, template editing, and history review |
| **Cloud Licensing** | Supabase (PostgreSQL, REST) | Lightweight remote validation of active monthly subscriptions |

---

## 🤖 Development & Engineering Approach
* **Product Vision & Architecture:** I formulated the initial concept, identified the market friction (lost clients from missed calls), and designed the operational workflow. When complex payment gateways proved impractical, I pivoted to an on-device utility coupled with a lightweight remote licensing receiver on Supabase.
* **AI-Steered Implementation:** I did not write the bulk of the Kotlin and React Native codebase by hand from scratch. Instead, I acted as the systems architect and prompt engineer: reading documentation, establishing functional constraints, and guiding AI assistants to produce the code. When OS background execution failed in practice, I directed the troubleshooting process that led to the native Kotlin service and shared-storage model.

---

## 💡 Lessons Learned & Engineering Takeaways
* **Mobile OS Lifecycle Realities:** Working through background call interception taught me that cross-platform frameworks (React Native) have hard limits when the OS suspends background runtimes. Learning how Android manages processes (Doze Mode) highlighted why native platform boundaries (Kotlin services) are indispensable.
* **Pragmatic Product Pivoting:** Starting with an overly complicated in-app checkout dream and running into real-world friction taught me to strip away non-essential features and prioritize the core value: catching missed calls immediately.
* **Testing on Real Hardware:** Emulators often mask background throttling and battery optimizations. Testing on physical devices was crucial to catching bridge failures and designing the native `SharedPreferences` shared storage model.

---

## 🧪 Testing & Hardware Verification

To verify that background telephony interception and SMS dispatches operate reliably on a connected Android device or emulator with ADB:

```bash
# Monitor native module logs in real time
adb logcat -s CallKeeper:D SMSHandler:I
```

* **Test Case 1 (Background Dispatch):** Swipe the app away from memory, place a missed call to the device, and verify delivery via logcat.
* **Test Case 2 (Anti-Spam Filter):** Call a second time within the cooldown period and verify that the duplicate SMS is suppressed.

---

## 📚 Detailed Documentation
* **[Native Architecture Specification](docs/ARCHITECTURE.md):** Deep dive into the shared storage pattern, event flow, and native bridge design.
* **[Native Module Integration](docs/NATIVE_INTEGRATION.md):** Android telephony service details and background execution mechanics.

---

<details>
<summary><b>🇵🇹 Versão em Português</b></summary>

### 📲 ClientS Pro: Automação de Chamadas e Resposta SMS em Segundo Plano
Aplicação móvel híbrida para Android concebida para reter potenciais clientes ao responder de forma automática e imediata por SMS a chamadas perdidas.

* **Conceito & Modelo de Negócio:** A ideia original envolvia pagamentos complexos na app, mas foi feito um pivot pragmático para uma ferramenta instalada no telemóvel com validação remota de licenças mensais (via Supabase), ativada após confirmação de pagamento.
* **Desafio Técnico:** O Android suspende o JavaScript quando o ecrã bloqueia. A solução passou por intercetar eventos através de um serviço nativo em Kotlin com `SharedPreferences` como fonte única da verdade para controlo de anti-spam (30 minutos) e histórico.
* **O meu papel & Desenvolvimento com IA:** Não escrevi a maior parte do código Kotlin/React Native manualmente de raiz. O meu papel foi o de arquiteto de produto e engenheiro de sistemas: desenhei o fluxo, li documentação, defini as regras de negócio e orientei ferramentas de IA com instruções rigorosas para gerar a implementação, intervindo no diagnóstico e ajustes de código quando surgiram constrangimentos no telemóvel real.
* **O que aprendi:** Os limites dos frameworks híbridos perante a gestão de energia e ciclo de vida de um SO móvel (Doze Mode), a importância de simplificar o produto inicial (pivot de pagamentos) e a necessidade de testar em hardware físico real.
</details>
