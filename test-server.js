// Simple test server to verify Express works
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '100mb' }));

app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Test server running',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mode: 'BYOK',
        supabase: !!process.env.VITE_SUPABASE_URL,
        port: PORT
    });
});

app.listen(PORT, () => {
    console.log('');
    console.log('🧪 ═══════════════════════════════════');
    console.log('   TEST SERVER RUNNING');
    console.log('═══════════════════════════════════');
    console.log('');
    console.log(`   📍 http://localhost:${PORT}`);
    console.log(`   🔍 http://localhost:${PORT}/api/health`);
    console.log('');
    console.log('   Press Ctrl+C to stop');
    console.log('');
});
