#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE devdb;
    CREATE DATABASE testdb;
EOSQL

# Run the setup script against the dev database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "devdb" -f /docker-entrypoint-initdb.d/setup.sql

# Run the setup script against the test database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "testdb" -f /docker-entrypoint-initdb.d/setup.sql