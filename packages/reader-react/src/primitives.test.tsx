// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectField, SwitchField, Tabs } from './primitives.js';

afterEach(cleanup);

describe('SelectField', () => {
  it('renders a labelled native select and reports changes', () => {
    const onValueChange = vi.fn();
    render(
      <SelectField
        label="Theme"
        value="light"
        onValueChange={onValueChange}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />,
    );
    const select = screen.getByLabelText('Theme') as HTMLSelectElement;
    expect(select.value).toBe('light');
    fireEvent.change(select, { target: { value: 'dark' } });
    expect(onValueChange).toHaveBeenCalledWith('dark');
  });
});

describe('SwitchField', () => {
  it('is a switch role that toggles', () => {
    const onCheckedChange = vi.fn();
    render(<SwitchField label="Justify" checked={false} onCheckedChange={onCheckedChange} />);
    const sw = screen.getByRole('switch', { name: 'Justify' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});

describe('Tabs', () => {
  it('shows only the active panel and switches on trigger click', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [tab, setTab] = useState('a');
      return (
        <Tabs
          value={tab}
          onValueChange={setTab}
          tabs={[
            { id: 'a', label: 'Alpha', content: <p>alpha body</p> },
            { id: 'b', label: 'Beta', content: <p>beta body</p> },
          ]}
        />
      );
    }
    render(<Harness />);
    expect(screen.getByText('alpha body')).toBeTruthy();
    expect(screen.queryByText('beta body')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Beta' }));
    expect(screen.getByText('beta body')).toBeTruthy();
    expect(screen.queryByText('alpha body')).toBeNull();
  });
});
