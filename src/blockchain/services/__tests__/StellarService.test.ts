import { describe, test, expect, vi, beforeEach } from 'vitest';
import { TESTNET_CONFIG, MAINNET_CONFIG, DEFAULT_NETWORK } from '../../config/networks';

// Mock the entire stellar-sdk module
vi.mock('@stellar/stellar-sdk', () => {
  // Use a class for mocking Server so it works with `new Server()`
  class MockServer {
    root = vi.fn().mockResolvedValue({ core_version: '19.0.0' });
    loadAccount = vi.fn().mockResolvedValue({
      accountId: () => 'GTEST',
      sequenceNumber: () => '123',
      incrementSequenceNumber: () => undefined,
      balances: [
        { asset_type: 'native', balance: '100.0000000' },
        { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'GISSUER', balance: '50.0000000' },
      ],
    });
    feeStats = vi.fn().mockResolvedValue({
      base_fee: '100',
      fee_charged: { p99: '150' },
    });
    submitTransaction = vi.fn().mockResolvedValue({
      hash: 'abc123',
      ledger: 1,
      successful: true,
    });
    transactions = vi.fn().mockReturnValue({
      forAccount: vi.fn().mockReturnValue({
        cursor: vi.fn().mockReturnValue({
          stream: vi.fn().mockImplementation(({ onmessage }: { onmessage: (tx: unknown) => void }) => {
            onmessage({ hash: 'tx123' });
            return () => {};
          }),
        }),
      }),
    });
  }

  class MockAsset {
    code: string;
    issuer: string | null;
    constructor(code: string, issuer?: string) {
      this.code = code;
      this.issuer = issuer || null;
    }
    static native() {
      return { code: 'XLM', issuer: null };
    }
  }

  class MockTransactionBuilder {
    addOperation = vi.fn().mockReturnThis();
    setTimeout = vi.fn().mockReturnThis();
    build = vi.fn().mockReturnValue({
      toXDR: vi.fn().mockReturnValue('mock-xdr'),
      operations: [{}],
    });
    constructor() {}
  }

  const mockOperation = {
    createAccount: vi.fn().mockReturnValue({}),
    changeTrust: vi.fn().mockReturnValue({}),
  };

  return {
    default: {
      Server: MockServer,
      Asset: MockAsset,
      TransactionBuilder: MockTransactionBuilder,
      Operation: mockOperation,
      Transaction: class {},
      FeeBumpTransaction: class {},
    },
  };
});

// Mock OfflineQueue
vi.mock('../OfflineQueue.ts', () => ({
  OfflineQueue: class {
    queueTransaction = vi.fn().mockResolvedValue('queue-id-123');
    getPendingTransactions = vi.fn().mockResolvedValue([]);
  },
}));

// Import after mocking
import { StellarService, stellarService } from '../StellarService';

describe('StellarService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stellarService.setNetwork(TESTNET_CONFIG);
  });

  describe('Network Configuration', () => {
    test('should set and get network configuration', () => {
      stellarService.setNetwork(TESTNET_CONFIG);
      expect(stellarService.getNetwork()).toEqual(TESTNET_CONFIG);
    });

    test('should switch to mainnet configuration', () => {
      stellarService.setNetwork(MAINNET_CONFIG);
      expect(stellarService.getNetwork()).toEqual(MAINNET_CONFIG);
    });

    test('should initialize with default network', () => {
      const service = new StellarService();
      expect(service.getNetwork()).toEqual(DEFAULT_NETWORK);
    });

    test('should initialize with custom network config', () => {
      const customConfig = {
        type: 'custom' as const,
        horizonUrl: 'https://custom.horizon.org',
        networkPassphrase: 'Custom Network',
      };
      const service = new StellarService(customConfig);
      expect(service.getNetwork()).toEqual(customConfig);
    });
  });

  describe('Network Status', () => {
    test('should return true when network is reachable', async () => {
      const status = await stellarService.getNetworkStatus();
      expect(status).toBe(true);
    });
  });

  describe('Account Operations', () => {
    test('should fetch account and balances', async () => {
      const balances = await stellarService.getBalances('GTEST');
      expect(balances).toHaveLength(2);
      expect(balances[0]).toEqual({ asset: 'XLM', issuer: 'Stellar', balance: 100 });
      expect(balances[1]).toEqual({ asset: 'USDC', issuer: 'GISSUER', balance: 50 });
    });

    test('should get account details', async () => {
      const account = await stellarService.getAccount('GTEST');
      expect(account.accountId()).toBe('GTEST');
    });
  });

  describe('Asset Operations', () => {
    test('should parse native XLM asset', () => {
      const asset = stellarService.parseAsset('xlm');
      expect(asset.code).toBe('XLM');
    });

    test('should parse native asset with "native" string', () => {
      const asset = stellarService.parseAsset('native');
      expect(asset.code).toBe('XLM');
    });

    test('should parse custom asset CODE:ISSUER format', () => {
      const asset = stellarService.parseAsset('USDC:GISSUERADDRESS1234567890123456789012345678901234567890');
      expect(asset).toBeDefined();
    });

    test('should throw error for invalid asset format', () => {
      expect(() => stellarService.parseAsset('INVALID')).toThrow('Invalid asset format');
    });

    test('should throw error for asset code longer than 12 characters', () => {
      expect(() => stellarService.parseAsset('TOOLONGASSETCODE:GISSUER1234567890123456789012345678901234567890')).toThrow('Invalid asset format');
    });
  });

  describe('Fee Estimation', () => {
    test('should estimate fee based on operation count', async () => {
      const fee = await stellarService.estimateFee(2);
      expect(fee).toBeGreaterThan(0);
    });

    test('should get current base fee', async () => {
      const baseFee = await stellarService.getCurrentBaseFee();
      expect(baseFee).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Transaction Streaming', () => {
    test('should stream transactions and return cleanup function', () => {
      const callback = vi.fn();
      const cleanup = stellarService.streamTransactions('GTEST', callback);
      
      expect(typeof cleanup).toBe('function');
      expect(callback).toHaveBeenCalledWith({ hash: 'tx123' });
    });

    test('should cleanup all active streams', () => {
      const callback = vi.fn();
      stellarService.streamTransactions('GTEST', callback);
      stellarService.streamTransactions('GTEST2', callback);
      
      // Should not throw
      stellarService.cleanupStreams();
    });
  });

  describe('Transaction Submission', () => {
    test('should submit transaction successfully', async () => {
      const mockTx = { toXDR: () => 'xdr' };
      const result = await stellarService.submitTransaction(mockTx as any);
      expect(result.hash).toBe('abc123');
      expect(result.successful).toBe(true);
    });
  });

  describe('Offline Queue Integration', () => {
    test('should queue transaction for offline submission', async () => {
      const mockTx = { toXDR: () => 'mock-xdr' };
      const queueId = await stellarService.queueForOffline(mockTx as any);
      expect(queueId).toBe('queue-id-123');
    });
  });
});
