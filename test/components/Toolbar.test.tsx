import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Toolbar from '../../src/components/Toolbar';

describe('Toolbar Component', () => {
  it('renders all tools', () => {
    const setMode = vi.fn();
    render(<Toolbar activeMode="none" setMode={setMode} />);

    expect(screen.getByLabelText('Select')).toBeInTheDocument();
    expect(screen.getByLabelText('Point')).toBeInTheDocument();
    expect(screen.getByLabelText('Circle')).toBeInTheDocument();
    expect(screen.getByLabelText('Line')).toBeInTheDocument();
    expect(screen.getByLabelText('Polygon')).toBeInTheDocument();
    expect(screen.getByLabelText('Measure')).toBeInTheDocument();
  });

  it('highlights the active tool', () => {
    const setMode = vi.fn();
    render(<Toolbar activeMode="circle" setMode={setMode} />);

    const circleBtn = screen.getByLabelText('Circle');
    // Check for the active class we use (bg-blue-600)
    expect(circleBtn).toHaveClass('bg-blue-600');
    
    const pointBtn = screen.getByLabelText('Point');
    expect(pointBtn).not.toHaveClass('bg-blue-600');
  });

  it('calls setMode when a tool is clicked', () => {
    const setMode = vi.fn();
    render(<Toolbar activeMode="none" setMode={setMode} />);

    fireEvent.click(screen.getByLabelText('Measure'));
    expect(setMode).toHaveBeenCalledWith('ruler');
  });
});