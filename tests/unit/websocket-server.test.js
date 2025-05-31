import { jest } from '@jest/globals';
import { RealtimeProgressServer } from '../../src/websocket-server.js';
import { WebSocketServer } from 'ws';

// Mock ws module
jest.mock('ws');

describe('RealtimeProgressServer', () => {
  let server;
  let mockHttpServer;
  let mockWss;
  let mockWs;

  beforeEach(() => {
    // Mock HTTP server
    mockHttpServer = {};

    // Mock WebSocket server
    mockWss = {
      on: jest.fn()
    };
    WebSocketServer.mockImplementation(() => mockWss);

    // Mock WebSocket client
    mockWs = {
      send: jest.fn(),
      on: jest.fn(),
      readyState: 1, // OPEN
      OPEN: 1
    };

    server = new RealtimeProgressServer(mockHttpServer);
  });

  describe('setupWebSocketServer', () => {
    it('should set up connection handler', () => {
      expect(mockWss.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should handle new connections', () => {
      const connectionHandler = mockWss.on.mock.calls[0][1];
      connectionHandler(mockWs, {});

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"connection"')
      );
      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('handleClientMessage', () => {
    let clientId;

    beforeEach(() => {
      // Simulate connection
      const connectionHandler = mockWss.on.mock.calls[0][1];
      connectionHandler(mockWs, {});
      
      // Get the generated client ID
      const connectionMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      clientId = connectionMessage.clientId;
    });

    it('should handle subscribe message', () => {
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')[1];
      const message = JSON.stringify({
        type: 'subscribe',
        projectId: 'project-123'
      });

      messageHandler(message);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"subscribed"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"projectId":"project-123"')
      );
    });

    it('should handle unsubscribe message', () => {
      // First subscribe
      server.subscribeToProject(clientId, 'project-123');
      
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')[1];
      const message = JSON.stringify({
        type: 'unsubscribe',
        projectId: 'project-123'
      });

      messageHandler(message);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"unsubscribed"')
      );
    });

    it('should handle invalid message', () => {
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')[1];
      
      messageHandler('invalid json');

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });

    it('should handle unknown message type', () => {
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')[1];
      const message = JSON.stringify({
        type: 'unknown'
      });

      messageHandler(message);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('Unknown message type')
      );
    });
  });

  describe('broadcast methods', () => {
    let clientId;

    beforeEach(() => {
      // Simulate connection and subscription
      const connectionHandler = mockWss.on.mock.calls[0][1];
      connectionHandler(mockWs, {});
      
      const connectionMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      clientId = connectionMessage.clientId;
      
      server.subscribeToProject(clientId, 'project-123');
      mockWs.send.mockClear(); // Clear previous calls
    });

    it('should broadcast task start', () => {
      const task = {
        id: 'task-1',
        agentType: 'backend_dev',
        action: 'implement_feature',
        status: 'running'
      };

      server.broadcastTaskStart('project-123', task);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"taskStart"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"agentType":"backend_dev"')
      );
    });

    it('should broadcast task progress', () => {
      server.broadcastTaskProgress('project-123', 'task-1', 50);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"taskProgress"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"progress":50')
      );
    });

    it('should broadcast task complete', () => {
      const task = { id: 'task-1', agentType: 'backend_dev', action: 'implement_feature' };
      const result = { filesCreated: 5, summary: 'Feature implemented' };

      server.broadcastTaskComplete('project-123', task, result);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"taskComplete"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"filesCreated":5')
      );
    });

    it('should broadcast task error', () => {
      const task = { id: 'task-1', agentType: 'backend_dev', action: 'implement_feature' };
      const error = new Error('Task failed');

      server.broadcastTaskError('project-123', task, error);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"taskError"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Task failed"')
      );
    });

    it('should not broadcast to unsubscribed projects', () => {
      server.broadcastTaskStart('project-456', { id: 'task-2' });

      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it('should not send to closed connections', () => {
      mockWs.readyState = 3; // CLOSED

      server.broadcastTaskStart('project-123', { id: 'task-1' });

      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  describe('broadcastToAll', () => {
    beforeEach(() => {
      // Simulate connection
      const connectionHandler = mockWss.on.mock.calls[0][1];
      connectionHandler(mockWs, {});
    });

    it('should broadcast to all connected clients', () => {
      const message = { type: 'announcement', text: 'System update' };

      server.broadcastToAll(message);

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify(message)
      );
    });
  });

  describe('client disconnect', () => {
    let clientId;

    beforeEach(() => {
      // Simulate connection and subscription
      const connectionHandler = mockWss.on.mock.calls[0][1];
      connectionHandler(mockWs, {});
      
      const connectionMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      clientId = connectionMessage.clientId;
      
      server.subscribeToProject(clientId, 'project-123');
    });

    it('should handle client disconnect', () => {
      const closeHandler = mockWs.on.mock.calls.find(call => call[0] === 'close')[1];
      
      expect(server.clients.has(clientId)).toBe(true);
      expect(server.getProjectSubscribers('project-123')).toBe(1);

      closeHandler();

      expect(server.clients.has(clientId)).toBe(false);
      expect(server.getProjectSubscribers('project-123')).toBe(0);
    });
  });

  describe('utility methods', () => {
    it('should generate unique client IDs', () => {
      const id1 = server.generateClientId();
      const id2 = server.generateClientId();

      expect(id1).toMatch(/^client_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should track connected clients count', () => {
      expect(server.getConnectedClients()).toBe(0);

      // Simulate connection
      const connectionHandler = mockWss.on.mock.calls[0][1];
      connectionHandler(mockWs, {});

      expect(server.getConnectedClients()).toBe(1);
    });

    it('should track project subscribers', () => {
      expect(server.getProjectSubscribers('project-123')).toBe(0);

      // Simulate connection and subscription
      const connectionHandler = mockWss.on.mock.calls[0][1];
      connectionHandler(mockWs, {});
      
      const connectionMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      const clientId = connectionMessage.clientId;
      
      server.subscribeToProject(clientId, 'project-123');

      expect(server.getProjectSubscribers('project-123')).toBe(1);
    });
  });
});