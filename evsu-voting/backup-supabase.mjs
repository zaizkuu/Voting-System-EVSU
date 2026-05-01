import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials. Make sure to run with --env-file=.env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
  'students',
  'organizations',
  'student_organizations',
  'profiles',
  'elections',
  'positions',
  'candidates',
  'policy_options',
  'votes'
];

async function backup() {
  const backupData = {};
  
  console.log("Starting backup...");
  
  for (const table of tables) {
    console.log(`Backing up table: ${table}...`);
    
    // Using select('*') gets all rows. Note: Supabase limits to 1000 rows by default,
    // but for a backup we might need pagination if there are more than 1000 rows.
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);
        
      if (error) {
        console.error(`Error backing up ${table}:`, error.message);
        hasMore = false;
        continue;
      }
      
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        page++;
      }
      
      if (!data || data.length < pageSize) {
        hasMore = false;
      }
    }
    
    backupData[table] = allData;
    console.log(`✅ ${table}: ${allData.length} records backed up.`);
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `supabase_backup_${timestamp}.json`;
  
  await fs.writeFile(filename, JSON.stringify(backupData, null, 2));
  console.log(`\n🎉 Backup complete! Saved to ${filename}`);
}

backup();
