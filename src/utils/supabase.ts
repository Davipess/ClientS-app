import { createClient } from '@supabase/supabase-js';

// 🔐 CONFIGURAÇÃO SUPABASE
// ⚠️ CREDENCIAIS CARREGADAS DE .env (Janeiro 2026)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Validação de credenciais
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('❌ Supabase URL ou ANON_KEY não configuradas! Verifique o arquivo .env');
}

if (!SUPABASE_URL.startsWith('https://')) {
  throw new Error('❌ Supabase URL inválida! Deve começar com https://');
}

if (SUPABASE_ANON_KEY.length < 100) {
  throw new Error('❌ Supabase ANON_KEY parece inválida (muito curta)');
}

console.log('✅ Supabase Client Initialized:');
console.log('   URL:', SUPABASE_URL);
console.log('   Key Length:', SUPABASE_ANON_KEY.length, 'chars');
console.log('   Key Preview:', SUPABASE_ANON_KEY.substring(0, 50) + '...');

// ⚠️ IMPORTANTE: Verifique Row Level Security (RLS) no Supabase!
// Se a app não desbloqueia, execute no SQL Editor do Supabase:
//
// ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
//
// CREATE POLICY "Allow public read access"
// ON licenses FOR SELECT
// TO anon
// USING (true);
//
// Isso permite que a app (usando anon key) leia a tabela licenses.

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export interface License {
  id: string;
  device_id: string;
  is_active: boolean;
  created_at: string;
  expires_at?: string;
}
