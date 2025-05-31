#!/usr/bin/env node

import redis from 'redis';

const client = redis.createClient({ url: 'redis://localhost:6379' });

async function viewDatabase() {
    try {
        await client.connect();
        console.log('🔍 DBot Redis Database Contents:\n');
        
        const keys = await client.keys('*');
        
        if (keys.length === 0) {
            console.log('❌ Database is empty - no data stored yet');
            console.log('\nExpected data:');
            console.log('- project:*:requests (task queues)');
            console.log('- activity:* (activity streams)');
            console.log('- logs:* (system logs)');
        } else {
            console.log(`📊 Found ${keys.length} keys:\n`);
            
            for (const key of keys) {
                const type = await client.type(key);
                console.log(`🔑 ${key} (${type})`);
                
                let value;
                switch (type) {
                    case 'string':
                        value = await client.get(key);
                        break;
                    case 'list':
                        value = await client.lRange(key, 0, -1);
                        break;
                    case 'hash':
                        value = await client.hGetAll(key);
                        break;
                    default:
                        value = '[complex type]';
                }
                
                console.log(`   ${JSON.stringify(value, null, 2)}\n`);
            }
        }
        
    } catch (error) {
        console.error('❌ Redis connection failed:', error.message);
    } finally {
        await client.disconnect();
    }
}

viewDatabase();
