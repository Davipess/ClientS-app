# 🔍 GUIA DE DIAGNÓSTICO - App Travada no Lock Screen

## 🎯 PROBLEMA ATUAL
- Device ID: `ddccff0dc874e2ff`
- Status no Supabase: `is_active = TRUE` ✅
- Problema: App não desbloqueia ao clicar "Verificar Novamente"

---

## 📋 CHECKLIST DE DIAGNÓSTICO

### ✅ PASSO 1: Verificar Android ID
Ao abrir a app, verás um alerta:
```
🔍 Diagnóstico
Passo 1: A obter Android ID...
```

Depois:
```
✅ Android ID
ID obtido: ddccff0dc874e2ff
```

**Se não vês o ID:**
- Problema no `expo-application`
- Verifica se o package está instalado: `npm ls expo-application`

---

### ✅ PASSO 2: Verificar Consulta Supabase
Verás um alerta:
```
🔍 Diagnóstico
Passo 2: A consultar Supabase...

Device ID: ddccff0dc874e2ff

⚠️ IMPORTANTE: Verifique se Row Level Security está configurada corretamente!
```

**AÇÃO CRÍTICA:**
Vai ao Supabase SQL Editor e executa:

```sql
-- 1. Ativar RLS (se ainda não estiver)
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- 2. Criar policy para leitura pública
DROP POLICY IF EXISTS "Allow public read access" ON licenses;

CREATE POLICY "Allow public read access"
ON licenses FOR SELECT
TO anon
USING (true);
```

---

### ✅ PASSO 3: Analisar Erros do Supabase

#### **ERRO COMUM 1: RLS Bloqueando Acesso**
```
❌ ERRO SUPABASE
Código: 42501
Mensagem: new row violates row-level security policy
```
**SOLUÇÃO:** Executa o SQL do Passo 2 acima.

#### **ERRO COMUM 2: Tabela Não Encontrada**
```
❌ ERRO SUPABASE
Código: 42P01
Mensagem: relation "public.licenses" does not exist
```
**SOLUÇÃO:** Executa `supabase_schema.sql` no SQL Editor.

#### **ERRO COMUM 3: ID Não Encontrado**
```
❌ ID NÃO ENCONTRADO
O Device ID "ddccff0dc874e2ff" não existe na tabela "licenses".
```
**SOLUÇÃO:** Insere o ID:
```sql
INSERT INTO licenses (device_id, is_active) 
VALUES ('ddccff0dc874e2ff', true);
```

---

### ✅ PASSO 4: Verificar Dados Retornados
Se tudo correr bem, verás:
```
📊 DADOS ENCONTRADOS
Device ID: ddccff0dc874e2ff
is_active: true
ID: 1
Criado em: 2026-01-09T...
```

Depois:
```
✅ SUCESSO!
Licença válida! A desbloquear app...
```

**Se `is_active: false`:**
```sql
UPDATE licenses 
SET is_active = true 
WHERE device_id = 'ddccff0dc874e2ff';
```

---

## 🔧 VERIFICAÇÕES ADICIONAIS

### 1. **Confirmar Credenciais Supabase**
Em `src/utils/supabase.ts`:
- URL: `https://ouibszhgxdyhgzbytyyu.supabase.co` ✅
- Anon Key: (Configurada) ✅

### 2. **Verificar Estado da Policy**
No Supabase Dashboard → Authentication → Policies:
- Tabela: `licenses`
- Policy: `Allow public read access`
- Comando: `SELECT`
- Roles: `anon`
- Using: `true`

Ou via SQL:
```sql
-- Ver policies ativas
SELECT * FROM pg_policies WHERE tablename = 'licenses';
```

### 3. **Testar Query Manualmente no Supabase**
No SQL Editor:
```sql
-- Como se fosse a app (usando anon role)
SET ROLE anon;

SELECT * FROM licenses WHERE device_id = 'ddccff0dc874e2ff';

-- Voltar ao role normal
RESET ROLE;
```

**Se retornar vazio com anon:** RLS está a bloquear!

---

## 🚨 SOLUÇÃO RÁPIDA (BYPASS RLS TEMPORÁRIO)

**APENAS PARA DEBUG - NÃO USAR EM PRODUÇÃO!**

```sql
-- Desativar RLS temporariamente
ALTER TABLE licenses DISABLE ROW LEVEL SECURITY;
```

Depois de funcionar, reativa:
```sql
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- E cria a policy correta
CREATE POLICY "Allow public read access"
ON licenses FOR SELECT
TO anon
USING (true);
```

---

## 📱 PRÓXIMOS PASSOS

1. **Reinstala a app** no dispositivo com as novas alterações:
   ```bash
   cd android
   ./gradlew clean
   ./gradlew assembleDebug
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

2. **Abre a app** e segue os alertas passo a passo

3. **Anota o erro exato** que aparece nos alertas

4. **Executa a query SQL** correspondente no Supabase

5. **Clica "Verificar Novamente"**

---

## 🐛 DEBUG AVANÇADO

### Ver Logs Completos no Terminal:
```bash
npx expo start
# Na app, abre o Menu Developer e ativa Remote JS Debugging
# Os logs detalhados aparecerão no Chrome DevTools Console
```

### Ver Logs Nativos Android:
```bash
adb logcat | grep -i "ReactNativeJS\|Supabase\|CallKeeper"
```

---

## ✅ CONFIRMAÇÃO FINAL

Se tudo funcionar, verás:
1. ✅ Alerta "Android ID obtido"
2. ✅ Alerta "Passo 2: A consultar Supabase"
3. ✅ Alerta "DADOS ENCONTRADOS" com `is_active: true`
4. ✅ Alerta "SUCESSO! Licença válida"
5. ✅ **App desbloqueia e mostra UI principal!**

---

## 📞 SUPORTE

Se continuares com problemas, envia:
1. Screenshots de TODOS os alertas
2. Output do SQL: `SELECT * FROM licenses WHERE device_id = 'ddccff0dc874e2ff';`
3. Output do SQL: `SELECT * FROM pg_policies WHERE tablename = 'licenses';`
4. Logs do terminal ao executar `npx expo start`
