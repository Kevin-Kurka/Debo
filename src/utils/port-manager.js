/**
 * Dynamic Port Manager
 * 
 * PURPOSE:
 * Manages dynamic port allocation to avoid conflicts with other applications.
 * Provides port discovery and assignment for all Debo services.
 * 
 * FEATURES:
 * - Dynamic port assignment with conflict detection
 * - Port range management for different service types
 * - Environment variable overrides
 * - Persistent port mapping for consistent service discovery
 * 
 * TODO:
 * - None
 */

import net from 'net';
import fs from 'fs-extra';
import path from 'path';
import logger from '../logger.js';

export class PortManager {
  constructor() {
    this.portMap = new Map();
    this.reservedPorts = new Set();
    this.configFile = path.join(process.cwd(), '.debo-ports.json');
    
    // Default port ranges for different services
    this.portRanges = {
      mcp: { start: 8000, end: 8099 },      // MCP servers
      websocket: { start: 8100, end: 8199 }, // WebSocket servers
      api: { start: 8200, end: 8299 },       // REST API servers
      database: { start: 8300, end: 8399 },  // Database connections
      monitoring: { start: 8400, end: 8499 }, // Monitoring/dashboard
      general: { start: 8500, end: 8999 }    // General purpose
    };
    
    // Load existing port assignments
    this.loadPortAssignments();
  }
  
  /**
   * Get an available port for a service
   * @param {string} serviceName - Name of the service
   * @param {string} serviceType - Type of service (mcp, websocket, api, etc.)
   * @param {number} preferredPort - Preferred port (optional)
   * @returns {Promise<number>} Available port number
   */
  async getPort(serviceName, serviceType = 'general', preferredPort = null) {
    // Check if we already have a port assigned for this service
    if (this.portMap.has(serviceName)) {
      const existingPort = this.portMap.get(serviceName);
      if (await this.isPortAvailable(existingPort)) {
        logger.info(`Using existing port ${existingPort} for ${serviceName}`);
        return existingPort;
      } else {
        logger.warn(`Existing port ${existingPort} for ${serviceName} is no longer available`);
        this.portMap.delete(serviceName);
      }
    }
    
    // Check environment variable override
    const envPort = process.env[`${serviceName.toUpperCase()}_PORT`];
    if (envPort) {
      const port = parseInt(envPort);
      if (await this.isPortAvailable(port)) {
        this.assignPort(serviceName, port);
        return port;
      } else {
        logger.warn(`Environment port ${port} for ${serviceName} is not available`);
      }
    }
    
    // Try preferred port first
    if (preferredPort && await this.isPortAvailable(preferredPort)) {
      this.assignPort(serviceName, preferredPort);
      return preferredPort;
    }
    
    // Find available port in range
    const range = this.portRanges[serviceType] || this.portRanges.general;
    const port = await this.findAvailablePortInRange(range.start, range.end);
    
    if (port) {
      this.assignPort(serviceName, port);
      logger.info(`Assigned dynamic port ${port} to ${serviceName} (${serviceType})`);
      return port;
    }
    
    throw new Error(`No available ports found for ${serviceName} in ${serviceType} range`);
  }
  
  /**
   * Check if a port is available
   * @param {number} port - Port to check
   * @returns {Promise<boolean>} True if port is available
   */
  async isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.listen(port, '127.0.0.1', () => {
        server.once('close', () => {
          resolve(true);
        });
        server.close();
      });
      
      server.on('error', () => {
        resolve(false);
      });
    });
  }
  
  /**
   * Find an available port within a range
   * @param {number} start - Start of range
   * @param {number} end - End of range
   * @returns {Promise<number|null>} Available port or null
   */
  async findAvailablePortInRange(start, end) {
    for (let port = start; port <= end; port++) {
      if (!this.reservedPorts.has(port) && await this.isPortAvailable(port)) {
        return port;
      }
    }
    return null;
  }
  
  /**
   * Assign a port to a service
   * @param {string} serviceName - Name of the service
   * @param {number} port - Port number
   */
  assignPort(serviceName, port) {
    this.portMap.set(serviceName, port);
    this.reservedPorts.add(port);
    this.savePortAssignments();
  }
  
  /**
   * Release a port from a service
   * @param {string} serviceName - Name of the service
   */
  releasePort(serviceName) {
    if (this.portMap.has(serviceName)) {
      const port = this.portMap.get(serviceName);
      this.portMap.delete(serviceName);
      this.reservedPorts.delete(port);
      this.savePortAssignments();
      logger.info(`Released port ${port} from ${serviceName}`);
    }
  }
  
  /**
   * Get the assigned port for a service
   * @param {string} serviceName - Name of the service
   * @returns {number|null} Port number or null if not assigned
   */
  getAssignedPort(serviceName) {
    return this.portMap.get(serviceName) || null;
  }
  
  /**
   * Get all port assignments
   * @returns {Object} Map of service names to ports
   */
  getAllAssignments() {
    return Object.fromEntries(this.portMap);
  }
  
  /**
   * Load port assignments from file
   */
  loadPortAssignments() {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = fs.readJsonSync(this.configFile);
        this.portMap = new Map(Object.entries(data.ports || {}));
        this.reservedPorts = new Set(Object.values(data.ports || {}));
        logger.debug('Loaded existing port assignments:', data.ports);
      }
    } catch (error) {
      logger.warn('Failed to load port assignments:', error.message);
    }
  }
  
  /**
   * Save port assignments to file
   */
  savePortAssignments() {
    try {
      const data = {
        ports: Object.fromEntries(this.portMap),
        timestamp: new Date().toISOString()
      };
      fs.writeJsonSync(this.configFile, data, { spaces: 2 });
    } catch (error) {
      logger.warn('Failed to save port assignments:', error.message);
    }
  }
  
  /**
   * Add reserved ports that should not be assigned
   * @param {number[]} ports - Array of ports to reserve
   */
  addReservedPorts(ports) {
    ports.forEach(port => this.reservedPorts.add(port));
  }
  
  /**
   * Get system information about ports
   * @returns {Object} Port usage information
   */
  getPortInfo() {
    return {
      assigned: Object.fromEntries(this.portMap),
      reserved: Array.from(this.reservedPorts),
      ranges: this.portRanges,
      configFile: this.configFile
    };
  }
  
  /**
   * Clean up unused port assignments
   */
  async cleanup() {
    const servicesToRemove = [];
    
    for (const [serviceName, port] of this.portMap) {
      if (!(await this.isPortAvailable(port))) {
        // Port is in use, assume service is still running
        continue;
      }
      
      // Port is available, service might be stopped
      // Keep assignment for quick restart, but mark for potential cleanup
      logger.debug(`Service ${serviceName} on port ${port} appears to be stopped`);
    }
    
    // Don't automatically remove assignments to allow for service restarts
    // Manual cleanup can be done if needed
  }
}

// Global port manager instance
export const portManager = new PortManager();

// Add common reserved ports
portManager.addReservedPorts([
  22,    // SSH
  25,    // SMTP
  53,    // DNS
  80,    // HTTP
  110,   // POP3
  143,   // IMAP
  443,   // HTTPS
  993,   // IMAPS
  995,   // POP3S
  3000,  // Common dev server
  3001,  // Common dev server
  5000,  // Common dev server
  5432,  // PostgreSQL
  6379,  // Redis
  8080,  // HTTP alternate
  8443,  // HTTPS alternate
  11434, // Ollama
  27017  // MongoDB
]);

export default PortManager;