import { createClient } from '@supabase/supabase-js';

const test = async () => {
    try {
        console.log('Testing /api/health');
        const r1 = await fetch('http://localhost:3000/api/health');
        console.log('health:', await r1.json());
        
        console.log('Testing /api/my-courses without auth');
        const r2 = await fetch('http://localhost:3000/api/my-courses?tenantId=undefined');
        console.log('my-courses status:', r2.status);
        console.log('my-courses body:', await r2.json());
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

test();
