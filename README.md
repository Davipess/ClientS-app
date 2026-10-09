# 📲 ClientS Pro — Resilient Call Response & Messaging Automation

> A hybrid mobile utility for Android designed to capture missed calls and automatically deliver templated SMS responses, engineered to overcome mobile background execution constraints.

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
* **Product Vision & Architecture:** I formulated the initial concept, identified the market friction (lost clients from missed calls), and designed the operational workflow. When complex payment gateways proved impractical, I pivoted to an on-device utility coupled with a lightweight remote licensing receiver on Supabase.
* **AI-Steered Implementation:** I did not write the bulk of the Kotlin and React Native codebase by hand from scratch. Instead, I acted as the systems architect and prompt engineer: reading documentation, establishing functional constraints, and guiding AI assistants to produce the code. When OS background execution failed in practice, I directed the troubleshooting process that led to the native Kotlin service and shared-storage model.

## 📚 Detailed Documentation
* **[Native Architecture Specification](docs/ARCHITECTURE.md):** Deep dive into the shared storage pattern, event flow, and native bridge design.
* **[Native Module Integration](docs/NATIVE_INTEGRATION.md):** Android telephony service details and background execution mechanics.

---

<details>
<summary><b>🇵🇹 Versão em Português</b></summary>

### 📲 ClientS Pro — Automação de Chamadas e Resposta SMS em Segundo Plano
Aplicação móvel híbrida para Android concebida para reter potenciais clientes ao responder de forma automática e imediata por SMS a chamadas perdidas.

* **Conceito & Modelo de Negócio:** A ideia original envolvia pagamentos complexos na app, mas foi feito um pivot pragmático para uma ferramenta instalada no telemóvel com validação remota de licenças mensais (via Supabase), ativada após confirmação de pagamento.
* **Desafio Técnico:** O Android suspende o JavaScript quando o ecrã bloqueia. A solução passou por intercetar eventos através de um serviço nativo em Kotlin com `SharedPreferences` como fonte única da verdade para controlo de anti-spam (30 minutos) e histórico.
* **O meu papel & Desenvolvimento com IA:** Não escrevi a maior parte do código Kotlin/React Native manualmente de raiz. O meu papel foi o de arquiteto de produto e engenheiro de sistemas: desenhei o fluxo, li documentação, defini as regras de negócio e orientei ferramentas de IA com instruções rigorosas para gerar a implementação, intervindo no diagnóstico e ajustes de código quando surgiram constrangimentos no telemóvel real.
</details>
