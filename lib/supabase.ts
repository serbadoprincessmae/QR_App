import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iqbeyznamqbzirkyropk.supabase.co';
const supabaseAnonKey = 'sb_publishable_cBVW3vPpI75Tx_eyafaTKw_ImTpQN54';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});