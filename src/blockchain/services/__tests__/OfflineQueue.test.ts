import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { OfflineQueue, QueuedTransaction } from '../OfflineQueue';

// Mock IndexedDB
const mockObjectStore = {
  put: vi.fn(),
  getAll: vi.fn(),
};

const mockTransaction = {
  objectStore: vi.fn().mockReturnValue(mockObjectStore),
};

const mockDB = {
  transaction: vi.fn().mockReturnValue(mockTransaction),
  objectStoreNames: {
    contains: vi.fn().mockReturnValue(true),
  },
  createObjectStore: vi.fn(),
};

const mockRequest = {
  result: mockDB,
  error: null as DOMException | null,
  onsuccess: null as ((event: Event) => void) | null,
  onerror: null as ((event: Event) => void) | null,
  onupgradeneeded: null as ((event: IDBVersionChangeEvent) => void) | null,
};

vi.stubGlobal('indexedDB', {
  open: vi.fn().mockReturnValue(mockRequest),
});

vi.stubGlobal('crypto', {
  randomUUID: vi.fn().mockReturnValue('test-uuid-123'),
});

describe('OfflineQueue', () => {
  let offlineQueue: OfflineQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    offlineQueue = new OfflineQueue();
    // Reset mock functions
    mockObjectStore.put.mockReset();
    mockObjectStore.getAll.mockReset();
    mockDB.objectStoreNames.contains.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('queueTransaction', () => {
    test('should queue a transaction and return its ID', async () => {
      const xdr = 'mock-xdr-string';
      
      // Simulate successful IndexedDB operations
      mockObjectStore.put.mockImplementation(() => {
        const putRequest = {
          result: 'test-uuid-123',
          onsuccess: null as ((event: Event) => void) | null,
          onerror: null as ((event: Event) => void) | null,
        };
        setTimeout(() => {
          if (putRequest.onsuccess) {
            putRequest.onsuccess({} as Event);
          }
        }, 0);
        return putRequest;
      });

      // Trigger DB open success
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess({} as Event);
        }
      }, 0);

      const id = await offlineQueue.queueTransaction(xdr);
      
      expect(id).toBe('test-uuid-123');
      expect(mockDB.transaction).toHaveBeenCalledWith('transactions', 'readwrite');
    });

    test('should create object store on upgrade if not exists', async () => {
      mockDB.objectStoreNames.contains.mockReturnValue(false);
      
      mockObjectStore.put.mockImplementation(() => {
        const putRequest = {
          result: 'test-uuid-123',
          onsuccess: null as ((event: Event) => void) | null,
          onerror: null as ((event: Event) => void) | null,
        };
        setTimeout(() => {
          if (putRequest.onsuccess) {
            putRequest.onsuccess({} as Event);
          }
        }, 0);
        return putRequest;
      });

      setTimeout(() => {
        if (mockRequest.onupgradeneeded) {
          mockRequest.onupgradeneeded({} as IDBVersionChangeEvent);
        }
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess({} as Event);
        }
      }, 0);

      const id = await offlineQueue.queueTransaction('test-xdr');
      
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('transactions', { keyPath: 'id' });
      expect(id).toBe('test-uuid-123');
    });

    test('should reject on database open error', async () => {
      const testError = new DOMException('Test error');
      mockRequest.error = testError;

      setTimeout(() => {
        if (mockRequest.onerror) {
          mockRequest.onerror({} as Event);
        }
      }, 0);

      await expect(offlineQueue.queueTransaction('test-xdr')).rejects.toEqual(testError);
    });

    test('should reject on put error', async () => {
      const testError = new DOMException('Put error');
      
      mockObjectStore.put.mockImplementation(() => {
        const putRequest = {
          result: null,
          error: testError,
          onsuccess: null as ((event: Event) => void) | null,
          onerror: null as ((event: Event) => void) | null,
        };
        setTimeout(() => {
          if (putRequest.onerror) {
            putRequest.onerror({} as Event);
          }
        }, 0);
        return putRequest;
      });

      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess({} as Event);
        }
      }, 0);

      await expect(offlineQueue.queueTransaction('test-xdr')).rejects.toEqual(testError);
    });
  });

  describe('getPendingTransactions', () => {
    test('should return all pending transactions', async () => {
      const mockTransactions: QueuedTransaction[] = [
        { id: 'tx-1', xdr: 'xdr-1', status: 'pending', timestamp: Date.now() },
        { id: 'tx-2', xdr: 'xdr-2', status: 'retrying', timestamp: Date.now() },
      ];

      mockObjectStore.getAll.mockImplementation(() => {
        const getAllRequest = {
          result: mockTransactions,
          onsuccess: null as ((event: Event) => void) | null,
          onerror: null as ((event: Event) => void) | null,
        };
        setTimeout(() => {
          if (getAllRequest.onsuccess) {
            getAllRequest.onsuccess({} as Event);
          }
        }, 0);
        return getAllRequest;
      });

      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess({} as Event);
        }
      }, 0);

      const transactions = await offlineQueue.getPendingTransactions();
      
      expect(transactions).toHaveLength(2);
      expect(transactions[0].id).toBe('tx-1');
      expect(transactions[1].status).toBe('retrying');
      expect(mockDB.transaction).toHaveBeenCalledWith('transactions', 'readonly');
    });

    test('should return empty array when no transactions', async () => {
      mockObjectStore.getAll.mockImplementation(() => {
        const getAllRequest = {
          result: [],
          onsuccess: null as ((event: Event) => void) | null,
          onerror: null as ((event: Event) => void) | null,
        };
        setTimeout(() => {
          if (getAllRequest.onsuccess) {
            getAllRequest.onsuccess({} as Event);
          }
        }, 0);
        return getAllRequest;
      });

      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess({} as Event);
        }
      }, 0);

      const transactions = await offlineQueue.getPendingTransactions();
      
      expect(transactions).toHaveLength(0);
    });

    test('should reject on getAll error', async () => {
      const testError = new DOMException('GetAll error');
      
      mockObjectStore.getAll.mockImplementation(() => {
        const getAllRequest = {
          result: null,
          error: testError,
          onsuccess: null as ((event: Event) => void) | null,
          onerror: null as ((event: Event) => void) | null,
        };
        setTimeout(() => {
          if (getAllRequest.onerror) {
            getAllRequest.onerror({} as Event);
          }
        }, 0);
        return getAllRequest;
      });

      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess({} as Event);
        }
      }, 0);

      await expect(offlineQueue.getPendingTransactions()).rejects.toEqual(testError);
    });
  });

  describe('QueuedTransaction interface', () => {
    test('should have correct status types', () => {
      const pendingTx: QueuedTransaction = {
        id: 'test-id',
        xdr: 'test-xdr',
        status: 'pending',
        timestamp: Date.now(),
      };

      const retryingTx: QueuedTransaction = {
        id: 'test-id-2',
        xdr: 'test-xdr-2',
        status: 'retrying',
        timestamp: Date.now(),
      };

      const failedTx: QueuedTransaction = {
        id: 'test-id-3',
        xdr: 'test-xdr-3',
        status: 'failed',
        timestamp: Date.now(),
      };

      expect(pendingTx.status).toBe('pending');
      expect(retryingTx.status).toBe('retrying');
      expect(failedTx.status).toBe('failed');
    });
  });
});
