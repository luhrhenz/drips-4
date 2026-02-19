import { describe, test, expect } from 'vitest';
import {
  NetworkConfig,
  MAINNET_CONFIG,
  TESTNET_CONFIG,
  DEFAULT_NETWORK,
} from '../networks';

describe('Network Configurations', () => {
  describe('MAINNET_CONFIG', () => {
    test('should have correct mainnet type', () => {
      expect(MAINNET_CONFIG.type).toBe('mainnet');
    });

    test('should have correct mainnet horizon URL', () => {
      expect(MAINNET_CONFIG.horizonUrl).toBe('https://horizon.stellar.org');
    });

    test('should have correct mainnet network passphrase', () => {
      expect(MAINNET_CONFIG.networkPassphrase).toBe('Public Global Stellar Network ; September 2015');
    });

    test('should have soroban RPC URL for mainnet', () => {
      expect(MAINNET_CONFIG.sorobanRpcUrl).toBe('https://mainnet.sorobanrpc.com');
    });
  });

  describe('TESTNET_CONFIG', () => {
    test('should have correct testnet type', () => {
      expect(TESTNET_CONFIG.type).toBe('testnet');
    });

    test('should have correct testnet horizon URL', () => {
      expect(TESTNET_CONFIG.horizonUrl).toBe('https://horizon-testnet.stellar.org');
    });

    test('should have correct testnet network passphrase', () => {
      expect(TESTNET_CONFIG.networkPassphrase).toBe('Test SDF Network ; September 2015');
    });

    test('should have soroban RPC URL for testnet', () => {
      expect(TESTNET_CONFIG.sorobanRpcUrl).toBe('https://soroban-testnet.stellar.org');
    });
  });

  describe('DEFAULT_NETWORK', () => {
    test('should default to testnet configuration', () => {
      expect(DEFAULT_NETWORK).toEqual(TESTNET_CONFIG);
    });

    test('should be of type testnet', () => {
      expect(DEFAULT_NETWORK.type).toBe('testnet');
    });
  });

  describe('NetworkConfig interface', () => {
    test('should allow creating custom network config', () => {
      const customConfig: NetworkConfig = {
        type: 'custom',
        horizonUrl: 'https://custom.horizon.example.com',
        networkPassphrase: 'Custom Test Network',
      };

      expect(customConfig.type).toBe('custom');
      expect(customConfig.horizonUrl).toBe('https://custom.horizon.example.com');
      expect(customConfig.networkPassphrase).toBe('Custom Test Network');
      expect(customConfig.sorobanRpcUrl).toBeUndefined();
    });

    test('should allow custom config with soroban RPC', () => {
      const customConfig: NetworkConfig = {
        type: 'custom',
        horizonUrl: 'https://custom.horizon.example.com',
        networkPassphrase: 'Custom Test Network',
        sorobanRpcUrl: 'https://custom.soroban.example.com',
      };

      expect(customConfig.sorobanRpcUrl).toBe('https://custom.soroban.example.com');
    });

    test('should validate network type values', () => {
      const mainnetConfig: NetworkConfig = { ...MAINNET_CONFIG };
      const testnetConfig: NetworkConfig = { ...TESTNET_CONFIG };
      const customConfig: NetworkConfig = {
        type: 'custom',
        horizonUrl: 'https://example.com',
        networkPassphrase: 'test',
      };

      expect(['mainnet', 'testnet', 'custom']).toContain(mainnetConfig.type);
      expect(['mainnet', 'testnet', 'custom']).toContain(testnetConfig.type);
      expect(['mainnet', 'testnet', 'custom']).toContain(customConfig.type);
    });
  });

  describe('Configuration immutability', () => {
    test('mainnet and testnet configs should have different values', () => {
      expect(MAINNET_CONFIG.horizonUrl).not.toBe(TESTNET_CONFIG.horizonUrl);
      expect(MAINNET_CONFIG.networkPassphrase).not.toBe(TESTNET_CONFIG.networkPassphrase);
      expect(MAINNET_CONFIG.type).not.toBe(TESTNET_CONFIG.type);
    });

    test('configs should have all required properties', () => {
      const configs = [MAINNET_CONFIG, TESTNET_CONFIG, DEFAULT_NETWORK];
      
      configs.forEach(config => {
        expect(config).toHaveProperty('type');
        expect(config).toHaveProperty('horizonUrl');
        expect(config).toHaveProperty('networkPassphrase');
      });
    });
  });
});
