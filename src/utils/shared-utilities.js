/**
 * Shared Utilities
 * Common utility functions used across the application
 */

import crypto from 'crypto';
import { createLogger } from '../logger.js';

const logger = createLogger('SharedUtilities');

export class ErrorHandler {
    static async handleWithRecovery(operation, retryCount = 3) {
        for (let i = 0; i < retryCount; i++) {
            try {
                return await operation();
            } catch (error) {
                logger.error(`Operation failed (attempt ${i + 1}/${retryCount}):`, error);
                if (i === retryCount - 1) throw error;
                
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            }
        }
    }
    
    static async withTimeout(operation, timeout = 30000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Operation timed out after ${timeout}ms`));
            }, timeout);
            
            operation()
                .then(result => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }
}

export class PerformanceMonitor {
    static timers = new Map();
    
    static startTimer(id) {
        this.timers.set(id, Date.now());
    }
    
    static endTimer(id) {
        const startTime = this.timers.get(id);
        if (!startTime) {
            logger.warn(`Timer ${id} not found`);
            return 0;
        }
        
        const duration = Date.now() - startTime;
        this.timers.delete(id);
        return duration;
    }
}

export class CryptoUtils {
    static generateTimeBasedId(prefix = '') {
        const timestamp = Date.now().toString(36);
        const random = crypto.randomBytes(4).toString('hex');
        return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
    }
    
    static generateUUID() {
        return crypto.randomUUID();
    }
    
    static hashString(input) {
        return crypto.createHash('sha256').update(input).digest('hex');
    }
}