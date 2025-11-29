import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AuthWidget from '../../src/components/AuthWidget';
import * as firebaseAuth from 'firebase/auth';

// Mock Firebase dependencies
vi.mock('../utils/firebase', () => ({
  auth: {},
  googleProvider: {}
}));

vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as object,
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    getAuth: vi.fn(() => ({})),  // Add this line
  };
});

describe('AuthWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Sign In button when no user is logged in', () => {
    render(<AuthWidget user={null} />);
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.queryByText('Logged In')).not.toBeInTheDocument();
  });

  it('renders User info and Logout when user is logged in', () => {
    const mockUser = {
      uid: '123',
      displayName: 'Test User',
      photoURL: 'http://example.com/photo.jpg',
      email: 'test@example.com'
    } as any;

    render(<AuthWidget user={mockUser} />);
    
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByTitle('Sign Out')).toBeInTheDocument();
    expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
  });

  it('calls signInWithPopup when Sign In is clicked', async () => {
    render(<AuthWidget user={null} />);
    
    const loginBtn = screen.getByText('Sign In');
    fireEvent.click(loginBtn);
    
    expect(firebaseAuth.signInWithPopup).toHaveBeenCalled();
  });

  it('calls signOut when Sign Out is clicked', async () => {
    const mockUser = { displayName: 'User' } as any;
    render(<AuthWidget user={mockUser} />);
    
    const logoutBtn = screen.getByTitle('Sign Out');
    fireEvent.click(logoutBtn);
    
    expect(firebaseAuth.signOut).toHaveBeenCalled();
  });
});