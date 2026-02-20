// Set required environment variables before any module loads
process.env.DATABASE_URL = 'mongodb://localhost:27017/test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes-only-minimum-32-chars';
process.env.NODE_ENV = 'test';
