import { describe, it, expect, beforeEach } from 'vitest';
import { WorkingMemory } from './workingMemory';
import {
  updateDialectBridge,
  consumeDialectBridge,
  getActiveDialectBridge,
  resolveDialectMeta,
} from './dialectBridge';

describe('dialectBridge', () => {
  let wm: WorkingMemory;

  beforeEach(() => {
    wm = new WorkingMemory(32);
  });

  it('resolves dialect meta from dialectMap', () => {
    const meta = resolveDialectMeta('ES/Barcelona', 'Barcelona');
    expect(meta.language).toBe('Spanish');
    expect(meta.dialectLabel).toMatch(/Catalan/i);
  });

  it('does not bridge on first location set', () => {
    const bridge = updateDialectBridge(wm, {
      dialectKey: 'ES/Barcelona',
      city: 'Barcelona',
      language: 'Spanish',
    });
    expect(bridge).toBeNull();
  });

  it('activates bridge when city shifts within same language', () => {
    updateDialectBridge(wm, {
      dialectKey: 'ES/Barcelona',
      city: 'Barcelona',
      language: 'Spanish',
    });
    const bridge = updateDialectBridge(wm, {
      dialectKey: 'AR/Buenos Aires',
      city: 'Buenos Aires',
      language: 'Spanish',
    });
    expect(bridge).not.toBeNull();
    expect(bridge!.sharedLanguage).toBe(true);
    expect(bridge!.messagesRemaining).toBe(4);

    const injection = consumeDialectBridge(wm);
    expect(injection).toMatch(/DIALECT BRIDGE/);
    expect(injection).toMatch(/Buenos Aires/);
    expect(getActiveDialectBridge(wm)?.messagesRemaining).toBe(3);
  });

  it('does not bridge across different languages', () => {
    updateDialectBridge(wm, {
      dialectKey: 'ES/Barcelona',
      city: 'Barcelona',
      language: 'Spanish',
    });
    const bridge = updateDialectBridge(wm, {
      dialectKey: 'FR/Paris',
      city: 'Paris',
      language: 'French',
    });
    expect(bridge).toBeNull();
  });
});
