import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { Application } from 'express';

describe('App', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  it('should respond to health check', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('environment');
  });

  it('should return 404 for unknown routes', async () => {
    const response = await request(app).get('/unknown-route');
    
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error', 'Not Found');
  });

  it('should apply CORS headers', async () => {
    const response = await request(app).get('/health');
    
    expect(response.headers).toHaveProperty('access-control-allow-origin');
  });

  describe('GET /hello', () => {
    it('should return a greeting message', async () => {
      const response = await request(app).get('/hello');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Hello World!');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return valid JSON response', async () => {
      const response = await request(app).get('/hello');
      
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should return a valid ISO timestamp', async () => {
      const response = await request(app).get('/hello');
      
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });
  });
});