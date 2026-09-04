// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { STORAGE_KEY } from '../lib/storage';

const navigate = (hash: string) => {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
};

describe('Canoga Park sequential workflow', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.location.hash = '#dashboard';
    window.scrollTo = vi.fn();
  });
  afterEach(() => cleanup());

  it('gates orders, rounds cases up, consolidates validation and invalidates downstream changes', async () => {
    render(<App />);

    const firstForecast = await screen.findByLabelText('Manager forecast 2026-09-07');
    expect(firstForecast).toHaveValue(12_600);
    expect(screen.getByText('Prepare supplier orders')).toBeInTheDocument();
    expect(screen.queryByText('1,183 units')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Validate Sales Forecast' }));
    expect((await screen.findAllByText('Sales forecast validated. Product requirements can now be calculated.')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Calculate Product Needs' }));

    await waitFor(() => expect(screen.getAllByText('1,183 units').length).toBeGreaterThan(0));
    expect(screen.getAllByText('25 cases').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Validate Supplier Order' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Validate Supplier Order' }));
    expect(await screen.findByText('Order included in Artimex consolidation')).toBeInTheDocument();

    navigate('#consolidation');
    await screen.findByRole('heading', { name: 'Artimex Production Consolidation' });
    const consolidatedRow = screen.getAllByText('Canoga Park').map((element) => element.closest('tr')).find(Boolean);
    expect(consolidatedRow).toBeTruthy();
    expect(within(consolidatedRow!).getByText('25')).toBeInTheDocument();
    expect(within(consolidatedRow!).getByText('included in consolidation')).toBeInTheDocument();

    navigate('#dashboard');
    await screen.findByRole('heading', { name: 'Weekly Planning — Canoga Park' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit forecast' }));
    fireEvent.change(screen.getByLabelText('Manager forecast 2026-09-07'), { target: { value: '14000' } });
    expect(await screen.findAllByText('needs review')).not.toHaveLength(0);
    expect(screen.getByText('Calculate product needs')).toBeInTheDocument();

    navigate('#consolidation');
    await screen.findByRole('heading', { name: 'Artimex Production Consolidation' });
    const invalidatedRow = screen.getAllByText('Canoga Park').map((element) => element.closest('tr')).find(Boolean);
    expect(invalidatedRow).toBeTruthy();
    expect(within(invalidatedRow!).getByText('not included')).toBeInTheDocument();

    navigate('#dashboard');
    await screen.findByRole('heading', { name: 'Weekly Planning — Canoga Park' });
    fireEvent.click(screen.getByRole('button', { name: 'Validate Sales Forecast' }));
    fireEvent.click(screen.getByRole('button', { name: 'Calculate Product Needs' }));
    await waitFor(() => expect(screen.getAllByText('1,368 units').length).toBeGreaterThan(0));
    expect(screen.getAllByText('29 cases').length).toBeGreaterThan(0);
  });

  it('keeps every existing navigation route available', async () => {
    render(<App />);
    const routes = [
      ['dashboard', 'Weekly Planning — Canoga Park'],
      ['forecast', 'Sales Forecast — Canoga Park'],
      ['analytics', 'Forecast Analytics'],
      ['orders', 'Product Needs & Supplier Orders'],
      ['inventory', 'Inventory Inputs'],
      ['suppliers', 'Your Supply Network'],
      ['corporate', 'Every Location. One Clear View.'],
      ['consolidation', 'Artimex Production Consolidation'],
      ['history', 'Decision History'],
      ['settings', 'Rules & Settings'],
    ];
    for (const [route, title] of routes) {
      navigate(`#${route}`);
      await waitFor(() => expect(document.querySelector('main h1')).toHaveTextContent(title));
    }
  });
});
