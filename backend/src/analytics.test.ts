import { describe, it, expect } from 'vitest';
import { oliviaResponseSchema, createFallbackResponse } from './olivia.js';

describe('Olivia One Response Validation', () => {
  it('validates correct response structure', () => {
    const response = {
      summary: 'Analysis shows moderate demand with stable supply',
      priority: 'medium' as const,
      confidence: 0.85,
      findings: [
        {
          title: 'High inventory on Product A',
          evidence: 'Current stock: 1200 units, weekly consumption: 150 units = 8 weeks supply',
          impact: 'Slow-moving capital, potential waste risk if shelf life < 60 days',
          severity: 'warning' as const,
        },
      ],
      actions: [
        {
          label: 'Reduce order quantity for Product A next week',
          reason: 'Current overstocking will cover 8 weeks of demand',
          module: 'orders',
          restaurantId: 'uuid-1',
          productId: 'uuid-2',
          supplierId: null,
        },
      ],
      warnings: [],
      dataQuality: {
        isDemo: false,
        missingData: [],
        limitations: [],
      },
    };

    expect(() => oliviaResponseSchema.parse(response)).not.toThrow();
  });

  it('rejects invalid priority', () => {
    const response = {
      summary: 'Test',
      priority: 'urgent' as any,
      confidence: 0.5,
      findings: [
        {
          title: 'Test',
          evidence: 'Test evidence',
          impact: 'Test impact',
          severity: 'info' as const,
        },
      ],
      actions: [],
      warnings: [],
      dataQuality: { isDemo: false, missingData: [], limitations: [] },
    };

    expect(() => oliviaResponseSchema.parse(response)).toThrow();
  });

  it('rejects confidence out of range', () => {
    const response = {
      summary: 'Test',
      priority: 'medium' as const,
      confidence: 1.5,
      findings: [
        {
          title: 'Test',
          evidence: 'Test evidence',
          impact: 'Test impact',
          severity: 'info' as const,
        },
      ],
      actions: [],
      warnings: [],
      dataQuality: { isDemo: false, missingData: [], limitations: [] },
    };

    expect(() => oliviaResponseSchema.parse(response)).toThrow();
  });

  it('creates fallback response when HF unavailable', () => {
    const context = {
      module: 'dashboard',
      restaurantId: undefined,
      userId: 'user-1',
      role: 'admin',
      period: { from: '2026-08-01', to: '2026-09-01' },
      metrics: { test: 'data' },
    };

    const fallback = createFallbackResponse(context, 'Service unavailable');

    expect(fallback.summary).toBeDefined();
    expect(fallback.priority).toBe('medium');
    expect(fallback.confidence).toBe(0);
    expect(fallback.dataQuality.isDemo).toBe(true);
    expect(fallback.warnings).toContain('Service unavailable');
  });

  it('validates minimal required findings', () => {
    const response = {
      summary: 'Test summary with minimum length',
      priority: 'low' as const,
      confidence: 0.5,
      findings: [
        {
          title: 'Finding',
          evidence: 'Evidence text',
          impact: 'Impact description',
          severity: 'info' as const,
        },
      ],
      actions: [],
      warnings: [],
      dataQuality: { isDemo: false, missingData: [], limitations: [] },
    };

    const validated = oliviaResponseSchema.parse(response);
    expect(validated.findings.length).toBeGreaterThan(0);
  });
});

