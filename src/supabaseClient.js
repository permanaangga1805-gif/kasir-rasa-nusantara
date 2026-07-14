import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://smemgdqmfvgccipdinox.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtZW1nZHFtZnZnY2NpcGRpbm94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMzA4MjIsImV4cCI6MjA5OTYwNjgyMn0.DVYnpJWJ6UE6hTlyVOYKrlNBwdPR5PGpMkucZedu9-s'

export const supabase = createClient(supabaseUrl, supabaseKey)