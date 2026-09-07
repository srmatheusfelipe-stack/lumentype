// js/supabase.js

const SUPABASE_URL = 'https://gmolxsxxhkxrddywwwhm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdtb2x4c3h4aGt4cmRkeXd3d2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMTY3MjQsImV4cCI6MjEwMTg5MjcyNH0.eYRqPBcBY6RnYDTuQ_hihrNFXixhHbae6m9FAk2Iovg';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("🚀 Supabase conectado com sucesso!");