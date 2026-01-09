# 🔐 SETUP DO SISTEMA DE LICENCIAMENTO

## 1️⃣ CONFIGURAR SUPABASE

### Criar Projeto no Supabase:
1. Acede a https://supabase.com
2. Cria um novo projeto
3. Copia o **Project URL** e a **anon public key**

### Criar Tabela:
1. Vai ao SQL Editor do Supabase
2. Cola e executa o conteúdo de `supabase_schema.sql`

### Configurar RLS (Row Level Security):
```sql
-- Permitir leitura pública (para a app verificar licenças)
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
ON licenses FOR SELECT
TO anon
USING (true);
```

## 2️⃣ CONFIGURAR A APP

### Editar `src/utils/supabase.ts`:
```typescript
const SUPABASE_URL = 'https://SEU_PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_CHAVE_ANON_AQUI';
```

## 3️⃣ ATIVAR LICENÇAS

### Via Dashboard Supabase:
1. Vai à tabela `licenses`
2. Clica em "Insert row"
3. Preenche:
   - `device_id`: ID do Android (fornecido pelo cliente)
   - `is_active`: `true`
   - `notes`: "Cliente pagou 10€ via MB WAY"

### Via SQL:
```sql
INSERT INTO licenses (device_id, is_active, notes) 
VALUES ('ANDROID_ID_DO_CLIENTE', true, 'Pagamento recebido');
```

### Desativar Licença:
```sql
UPDATE licenses 
SET is_active = false 
WHERE device_id = 'ANDROID_ID_DO_CLIENTE';
```

## 4️⃣ FLUXO DE VENDAS

1. **Cliente instala a app** → Vê tela vermelha com ID do dispositivo
2. **Cliente envia pagamento** (10€ via MB WAY para 91 XXX XX XX)
3. **Cliente envia o ID** por WhatsApp/SMS
4. **Tu ativas a licença** no Supabase
5. **Cliente clica em "Verificar Novamente"** → App desbloqueia!

## 5️⃣ TESTAR

### Adicionar licença de teste:
```sql
INSERT INTO licenses (device_id, is_active) 
VALUES ('test-device-123', true);
```

### No código de teste (temporário):
```typescript
// src/utils/supabase.ts (apenas para teste)
const androidId = 'test-device-123'; // Hardcoded para teste
```

## 6️⃣ ATUALIZAR NÚMERO DE CONTACTO

No ficheiro `App.tsx`, linha ~295, atualiza:
```typescript
<Text style={styles.phoneNumber}>91 SEU_NUMERO</Text>
```
