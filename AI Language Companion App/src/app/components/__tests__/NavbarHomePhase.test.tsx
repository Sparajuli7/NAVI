// @vitest-environment jsdom
/**
 * Tests for the App-level Navbar wiring:
 * - Home phase: both edit + settings buttons appear and are functional
 * - Chat phase: neither edit nor settings appears in Navbar (ConversationScreen owns them)
 *
 * These tests exercise the Navbar in isolation with the same prop
 * combinations that App.tsx passes in each phase.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Navbar } from '../Navbar';

// Helper: build props the way App.tsx does for the home phase (with active char)
function homePhaseProps(overrides: {
  onGoHome?: () => void;
  onEdit?: () => void;
  onSettings?: () => void;
} = {}) {
  return {
    onGoHome: vi.fn(),
    onEdit: vi.fn(),
    onSettings: vi.fn(),
    ...overrides,
  };
}

// Helper: build props the way App.tsx does for the chat phase
// (no edit/settings — ConversationScreen owns its own header)
function chatPhaseProps(overrides: { onGoHome?: () => void } = {}) {
  return {
    onGoHome: vi.fn(),
    // onEdit and onSettings intentionally omitted
    ...overrides,
  };
}

describe('Navbar — home phase wiring', () => {
  it('shows edit button on home phase', () => {
    render(<Navbar {...homePhaseProps()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3); // home + edit + settings
  });

  it('shows settings button on home phase', () => {
    render(<Navbar {...homePhaseProps()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it('edit button click fires onEdit', () => {
    const props = homePhaseProps();
    render(<Navbar {...props} />);
    const [, editBtn] = screen.getAllByRole('button');
    fireEvent.click(editBtn);
    expect(props.onEdit).toHaveBeenCalledOnce();
    expect(props.onSettings).not.toHaveBeenCalled();
  });

  it('settings button click fires onSettings', () => {
    const props = homePhaseProps();
    render(<Navbar {...props} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]); // last = settings
    expect(props.onSettings).toHaveBeenCalledOnce();
  });
});

describe('Navbar — chat phase wiring', () => {
  it('does NOT show edit button on chat phase', () => {
    render(<Navbar {...chatPhaseProps()} />);
    const buttons = screen.getAllByRole('button');
    // Only the home button
    expect(buttons).toHaveLength(1);
  });

  it('does NOT show settings button on chat phase', () => {
    render(<Navbar {...chatPhaseProps()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
  });
});

describe('Navbar — home phase without active character', () => {
  it('still shows settings button even with no active char (only onSettings provided)', () => {
    // When there's no active character, App passes onEdit=undefined but onSettings=handler
    render(<Navbar onGoHome={vi.fn()} onSettings={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2); // home + settings only (no edit)
  });

  it('does not render edit button when onEdit is undefined', () => {
    const onSettings = vi.fn();
    render(<Navbar onGoHome={vi.fn()} onSettings={onSettings} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);
    expect(onSettings).toHaveBeenCalledOnce();
  });
});
