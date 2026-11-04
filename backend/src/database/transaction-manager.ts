export const TRANSACTION_MANAGER = Symbol('TRANSACTION_MANAGER');

/** Await all repository operations inside the callback. Nested transactions are unsupported. */
export interface TransactionManager {
  withTransaction<T>(operation: () => Promise<T>): Promise<T>;
}
