# 🧪 GUIA DE TESTE COMPLETO - ClientS Pro Features

## 📋 O QUE FOI IMPLEMENTADO

### ✅ 1. ARQUITETURA NATIVA (SharedPreferences)
- **Local de armazenamento:** `clients_logs` SharedPreferences
- **Formato:** `timestamp|número|template` (pipe-delimited)
- **Capacidade:** 100 entradas (últimas 100 SMS enviados)
- **Sincronização:** Automática no resumo do app + manual via botão

### ✅ 2. FILTRO ANTI-SPAM (30 MINUTOS)
- **CHECK #5** adicionado ANTES do envio de SMS
- **Regra:** Bloqueia SMS duplicados ao mesmo número < 30 min
- **Exceção:** VIP bypassa sempre (prioridade absoluta)
- **Timestamp:** Registado após cada SMS enviado

### ✅ 3. LOGGING NATIVO ROBUSTO
- **Função:** `logSmsToSharedPrefs()` em CallKeeperService.kt
- **Chamada:** Após CADA SMS enviado (VIP + Regular)
- **Template:** Lê de `@CallKeeper:activeTemplateIndex` (0=A, 1=B, 2=C)

### ✅ 4. SINCRONIZAÇÃO REACT NATIVE
- **Método:** `CallKeeper.getSmsHistory()` - Lê logs nativos
- **Auto-sync:** AppState listener detecta quando app fica ativo
- **Manual sync:** Botão de teste força refresh

---

## 🔬 TESTES PARA REALIZAR

### TESTE 1: Verificar Compilação
```bash
cd C:\Users\davip\ResgatePro
.\android\gradlew.bat -p android assembleDebug

# Resultado esperado: BUILD SUCCESSFUL
# APK em: android/app/build/outputs/apk/debug/app-debug.apk
```

### TESTE 2: Instalar e Verificar Logs (CRITICAL)
```bash
# 1. Instalar APK
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# 2. Abrir app e ativar serviço
# 3. Fazer uma chamada perdida de um número NÃO-VIP
# 4. Esperar 2 minutos
# 5. Ver logcat em tempo real:

adb logcat | grep "CallKeeper"

# O que procurar:
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📞 CHAMADA PERDIDA detectada: +351912345678
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📲 CHECK #1: Master Switch ON = true
# 🌟 CHECK #2: VIP List (0)
# ℹ️ NÃO é VIP. Continuando verificações...
# 🚫 CHECK #3: Blacklist (0)
# 📇 CHECK #4: Ignorar contactos = false
# 🕒 CHECK #5: Anti-Spam Ativo = true
# ℹ️ Anti-Spam: Primeiro SMS para este número
# ✅ Verificações OK! Enviando SMS...
# ✅ SMS ENVIADO!
# 📊 SMS logged: +351912345678 | Template A
# 📊 Log format: 1736451234567|+351912345678|A
# 🕒 Timestamp registado para anti-spam

# 6. Abrir app
# 7. Ir para "Gestor de Respostas" (secção PRO)
# 8. Verificar se o SMS aparece no Histórico de Atividade
```

### TESTE 3: Anti-Spam (30 Minutos) - CRITICAL
```bash
# 1. Fazer primeira chamada perdida de +351912345678
# 2. Esperar SMS ser enviado (ver logcat)
# 3. IMEDIATAMENTE fazer segunda chamada do MESMO número
# 4. Ver logcat:

# Resultado ESPERADO:
# 🕒 CHECK #5: Anti-Spam Ativo = true
# ⏱️ BLOQUEADO POR ANTI-SPAM!
# ⏱️ Último SMS: 45s atrás
# ⏱️ Aguardar mais: 30 minutos
# ⏱️ SMS bloqueado (Anti-Spam)

# Resultado ERRADO (BUG):
# ✅ SMS ENVIADO! (sem verificação anti-spam)
```

### TESTE 4: VIP Bypassa Anti-Spam
```bash
# 1. Adicionar +351912345678 à lista VIP no app
# 2. Fazer chamada perdida
# 3. SMS enviado (OK)
# 4. IMEDIATAMENTE fazer segunda chamada do MESMO número VIP
# 5. Ver logcat:

# Resultado ESPERADO:
# 🌟🌟🌟 VIP DETECTADO! 🌟🌟🌟
# 🌟 BYPASS ATIVADO - Ignorando:
#     ✓ Bypass Blacklist
#     ✓ Bypass Agenda (Contactos Salvos)
#     ✓ Bypass Anti-Spam (30 min)
# 📤 ENVIANDO SMS VIP IMEDIATAMENTE
# ✅ SMS VIP ENVIADO!

# SMS deve ser enviado SEMPRE para VIP, mesmo < 30 min
```

### TESTE 5: Histórico de Atividade (UI)
```bash
# 1. Enviar 3 SMS (via chamadas perdidas ou botão teste)
# 2. Abrir app
# 3. Ir para secção "Gestor de Respostas"
# 4. Verificar:
#    - Números formatados: +351 912 345 678
#    - Template correto: A, B ou C
#    - Tempo relativo: "há X min" ou "há X horas"
#    - Logs numa linha só (sem quebras)

# 5. Pressionar botão "🧪 Testar Log (Dev Only)"
# 6. Verificar se aparece +351 912 345 678 no histórico
```

### TESTE 6: Templates A/B/C (A/B Testing)
```bash
# 1. Selecionar Template A
# 2. Fazer chamada perdida
# 3. Ver logcat: "📊 SMS logged: ... | Template A"
# 4. Abrir app, verificar "Template A" no histórico

# 5. Alterar para Template B
# 6. Fazer chamada perdida
# 7. Ver logcat: "📊 SMS logged: ... | Template B"
# 8. Verificar histórico mostra "Template B"

# Template C: Repetir processo
```

### TESTE 7: Sincronização Automática (AppState)
```bash
# 1. App FECHADO (force stop)
# 2. Fazer 2 chamadas perdidas (números diferentes)
# 3. Ver logcat: 2x "✅ SMS ENVIADO!" + 2x "📊 SMS logged"
# 4. Abrir app
# 5. Ver logcat: "📱 App became active - syncing logs..."
# 6. Ver logcat: "✅ Synced 2 logs from native module"
# 7. Histórico de Atividade mostra os 2 SMS imediatamente
```

---

## 🐛 PROBLEMAS CONHECIDOS E SOLUÇÕES

### Problema 1: Histórico vazio após SMS real
**Sintoma:** Botão teste funciona, mas SMS reais não aparecem.

**Causa:** Native Module não está chamando `logSmsToSharedPrefs()`.

**Verificar:**
```bash
adb logcat | grep "SMS logged"
# Se NÃO aparece "📊 SMS logged: ..." após envio → BUG
```

**Solução:** Verificar CallKeeperService.kt linha ~480 e ~395

---

### Problema 2: Anti-Spam não bloqueia
**Sintoma:** SMS duplicados enviados < 30 min.

**Causa:** CHECK #5 não foi executado.

**Verificar:**
```bash
adb logcat | grep "CHECK #5"
# Deve aparecer: "🕒 CHECK #5: Anti-Spam Ativo = true"
```

**Solução:** Verificar CallKeeperService.kt linha ~440

---

### Problema 3: Template errado no log
**Sintoma:** Histórico mostra sempre "Template A".

**Causa:** Índice do template não sincronizado.

**Verificar:**
```bash
adb logcat | grep "Template index"
# Deve aparecer: "✅ Template index X synced to native module"
```

**Solução:** Verificar App.tsx linha ~403 (`CallKeeper.setActiveTemplateIndex`)

---

## 📊 FLUXO COMPLETO (DIAGRAMA)

```
╔═══════════════════════════════════════════════════════════════╗
║                   CHAMADA PERDIDA DETECTADA                   ║
╚═══════════════════════════════════════════════════════════════╝
                            ↓
          ┌─────────────────────────────────────┐
          │ CHECK #1: Master Switch ON?         │
          │ ✅ SIM → Continuar                  │
          │ ❌ NÃO → STOP (serviço desligado)   │
          └─────────────────────────────────────┘
                            ↓
          ┌─────────────────────────────────────┐
          │ CHECK #2: É VIP?                    │
          │ ✅ SIM → BYPASS TUDO → ENVIAR SMS   │────┐
          │ ❌ NÃO → Continuar verificações     │    │
          └─────────────────────────────────────┘    │
                            ↓                         │
          ┌─────────────────────────────────────┐    │
          │ CHECK #3: Está na Blacklist?        │    │
          │ ✅ SIM → BLOQUEIO                   │    │
          │ ❌ NÃO → Continuar                  │    │
          └─────────────────────────────────────┘    │
                            ↓                         │
          ┌─────────────────────────────────────┐    │
          │ CHECK #4: Está na Agenda?           │    │
          │ (se ignoreContacts = true)          │    │
          │ ✅ SIM → BLOQUEIO                   │    │
          │ ❌ NÃO → Continuar                  │    │
          └─────────────────────────────────────┘    │
                            ↓                         │
          ┌─────────────────────────────────────┐    │
          │ CHECK #5: Anti-Spam (30 min)?       │    │
          │ (se antiSpamEnabled = true)         │    │
          │ ⏱️ < 30 min → BLOQUEIO              │    │
          │ ✅ >= 30 min → Continuar            │    │
          └─────────────────────────────────────┘    │
                            ↓                         │
          ┌─────────────────────────────────────┐    │
          │ ✅ ENVIAR SMS                       │◄───┘
          │ SMSHandler.sendSMS()                │
          └─────────────────────────────────────┘
                            ↓
          ┌─────────────────────────────────────┐
          │ 📊 LOG: logSmsToSharedPrefs()       │
          │ Formato: timestamp|número|template  │
          └─────────────────────────────────────┘
                            ↓
          ┌─────────────────────────────────────┐
          │ 🕒 TIMESTAMP: Registar em prefs     │
          │ Key: "last_sent_+351912345678"      │
          │ Value: System.currentTimeMillis()   │
          └─────────────────────────────────────┘
                            ↓
          ┌─────────────────────────────────────┐
          │ 🔄 SYNC: App abre → lê logs nativos │
          │ CallKeeper.getSmsHistory()          │
          │ Atualiza UI (Histórico de Atividade)│
          └─────────────────────────────────────┘
```

---

## 🎯 CHECKLIST DE SUCESSO

- [ ] BUILD SUCCESSFUL sem erros
- [ ] App instala no dispositivo
- [ ] Serviço ativa com botão toggle
- [ ] Chamada perdida detectada (ver logcat)
- [ ] SMS enviado (ver notificação)
- [ ] LOG aparece em logcat: "📊 SMS logged: ..."
- [ ] Histórico mostra SMS no app (após abrir)
- [ ] Formato correto: "+351 912 345 678 | Template A | há X min"
- [ ] Anti-Spam bloqueia duplicatas < 30 min
- [ ] VIP bypassa anti-spam sempre
- [ ] Template A/B/C funciona corretamente
- [ ] Botão teste (🧪) adiciona log ao histórico
- [ ] AppState sync funciona (app fechado → abrir → logs aparecem)

---

## 📞 DEBUGGING AVANÇADO

### Ver todos os logs do Native Module:
```bash
adb logcat | grep "CallKeeper"
```

### Ver apenas logs de SMS:
```bash
adb logcat | grep "SMS"
```

### Ver apenas anti-spam:
```bash
adb logcat | grep "Anti-Spam"
```

### Ver SharedPreferences (ROOT necessário):
```bash
adb shell
su
cat /data/data/com.davip.ResgatePro/shared_prefs/clients_logs.xml
```

### Limpar dados do app (reset completo):
```bash
adb shell pm clear com.davip.ResgatePro
```

---

**AUTOR:** David Figueiredo | © 2026  
**VERSÃO:** ClientS Pro Features v1.0  
**DATA:** 9 Janeiro 2026
