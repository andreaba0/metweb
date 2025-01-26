const { Database } = require('../utility/db_store');

describe('Database', () => {
    it('should check if a query is a transaction statement', () => {
        expect(Database.isTransactionStatement('BEGIN TRANSACTION')).toBe(true);
        expect(Database.isTransactionStatement('BEGIN')).toBe(true);
        expect(Database.isTransactionStatement('BEGIN TRANSACTION;')).toBe(true);
        expect(Database.isTransactionStatement('  BEGIN;')).toBe(true);
        expect(Database.isTransactionStatement('BEGIN IMMEDIATE TRANSACTION ;')).toBe(true);
        expect(Database.isTransactionStatement('COMMIT TRANSACTION')).toBe(true);
        expect(Database.isTransactionStatement('COMMIT')).toBe(true);
        expect(Database.isTransactionStatement('COMMIT TRANSACTION;')).toBe(true);
        expect(Database.isTransactionStatement('  COMMIT;')).toBe(true);
        expect(Database.isTransactionStatement('COMMIT TRANSACTION ;')).toBe(true);
        expect(Database.isTransactionStatement('ROLLBACK TRANSACTION')).toBe(true);
        expect(Database.isTransactionStatement('ROLLBACK')).toBe(true);
        expect(Database.isTransactionStatement('ROLLBACK TRANSACTION;')).toBe(true);
        expect(Database.isTransactionStatement('  ROLLBACK;')).toBe(true);
        expect(Database.isTransactionStatement('ROLLBACK TRANSACTION ;')).toBe(true);
        expect(Database.isTransactionStatement('SAVEPOINT abc')).toBe(true);
        expect(Database.isTransactionStatement('SAVEPOINT abc;')).toBe(true);
        expect(Database.isTransactionStatement('RELEASE SAVEPOINT abc')).toBe(true);
        expect(Database.isTransactionStatement('RELEASE SAVEPOINT abc;')).toBe(true);
        expect(Database.isTransactionStatement('SELECT 1')).toBe(false);
    });
})