-- Verso test database initialization
SELECT 'CREATE DATABASE verso_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'verso_test')\gexec

\c verso_test;
CREATE EXTENSION IF NOT EXISTS vector;

