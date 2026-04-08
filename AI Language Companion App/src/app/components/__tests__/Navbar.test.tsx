// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Navbar } from '../Navbar';

describe('Navbar', () => {
  it('renders the NAVI logo', () => {
    render(<Navbar onGoHome={() => {}} />);
    expect(screen.getByText('NAVI')).toBeTruthy();
  });

  it('calls onGoHome when logo is clicked', () => {
    const onGoHome = vi.fn();
    render(<Navbar onGoHome={onGoHome} />);
    fireEvent.click(screen.getByText('NAVI'));
    expect(onGoHome).toHaveBeenCalledOnce();
  });

  it('does NOT render the edit button when onEdit is not provided', () => {
    render(<Navbar onGoHome={() => {}} />);
    // Pencil icon button should be absent
    const buttons = screen.getAllByRole('button');
    // Only the home button should be present
    expect(buttons).toHaveLength(1);
  });

  it('does NOT render the settings button when onSettings is not provided', () => {
    render(<Navbar onGoHome={() => {}} onEdit={() => {}} />);
    const buttons = screen.getAllByRole('button');
    // Home + edit only — no settings button
    expect(buttons).toHaveLength(2);
  });

  it('renders the edit button when onEdit is provided', () => {
    const onEdit = vi.fn();
    render(<Navbar onGoHome={() => {}} onEdit={onEdit} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2); // home + edit
  });

  it('calls onEdit when the edit button is clicked', () => {
    const onEdit = vi.fn();
    render(<Navbar onGoHome={() => {}} onEdit={onEdit} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]); // second button is edit
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('renders the settings button when onSettings is provided', () => {
    const onSettings = vi.fn();
    render(<Navbar onGoHome={() => {}} onSettings={onSettings} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2); // home + settings
  });

  it('calls onSettings when the settings button is clicked', () => {
    const onSettings = vi.fn();
    render(<Navbar onGoHome={() => {}} onSettings={onSettings} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);
    expect(onSettings).toHaveBeenCalledOnce();
  });

  it('renders both edit and settings buttons when both props are provided', () => {
    render(<Navbar onGoHome={() => {}} onEdit={() => {}} onSettings={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3); // home + edit + settings
  });

  it('calls the correct handler when both edit and settings are present', () => {
    const onEdit = vi.fn();
    const onSettings = vi.fn();
    render(<Navbar onGoHome={() => {}} onEdit={onEdit} onSettings={onSettings} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]); // edit
    fireEvent.click(buttons[2]); // settings
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onSettings).toHaveBeenCalledOnce();
  });

  it('renders children in the right section', () => {
    render(
      <Navbar onGoHome={() => {}}>
        <span data-testid="child">hello</span>
      </Navbar>
    );
    expect(screen.getByTestId('child')).toBeTruthy();
  });
});
