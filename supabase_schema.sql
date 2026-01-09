-- 🔐 TABELA DE LICENÇAS DO CALLKEEPER

CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  notes TEXT
);

-- Índice para busca rápida por device_id
CREATE INDEX idx_licenses_device_id ON licenses(device_id);

-- Exemplo de inserção de licença
-- INSERT INTO licenses (device_id, is_active, notes) 
-- VALUES ('ANDROID_ID_AQUI', true, 'Cliente pagou via MB WAY');

-- Para ativar uma licença existente:
-- UPDATE licenses SET is_active = true WHERE device_id = 'ANDROID_ID_AQUI';

-- Para desativar:
-- UPDATE licenses SET is_active = false WHERE device_id = 'ANDROID_ID_AQUI';
