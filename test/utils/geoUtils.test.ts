import { describe, it, expect } from 'vitest';
import { calculateDistance, formatDistance, formatArea, getCentroid } from '../../src/utils/geoUtils';

describe('geoUtils', () => {
  describe('calculateDistance', () => {
    it('should calculate approximate distance between two points', () => {
      // Approximate distance between NYC and London
      const lat1 = 40.7128;
      const lon1 = -74.0060;
      const lat2 = 51.5074;
      const lon2 = -0.1278;
      
      const distance = calculateDistance(lat1, lon1, lat2, lon2);
      
      // Expected ~5570km, allow some margin for formula precision
      expect(distance).toBeGreaterThan(5500000); 
      expect(distance).toBeLessThan(5600000);
    });

    it('should return 0 for same points', () => {
      expect(calculateDistance(10, 10, 10, 10)).toBe(0);
    });
  });

  describe('formatDistance', () => {
    it('should format meters correctly', () => {
      expect(formatDistance(500)).toBe('500.0 m');
      expect(formatDistance(999)).toBe('999.0 m');
    });

    it('should format kilometers correctly', () => {
      expect(formatDistance(1000)).toBe('1.00 km');
      expect(formatDistance(1500)).toBe('1.50 km');
    });
  });

  describe('formatArea', () => {
    it('should format square meters', () => {
      expect(formatArea(500)).toBe('500.0 m²');
    });

    it('should format square kilometers', () => {
      expect(formatArea(2000000)).toBe('2.00 km²');
    });
  });

  describe('getCentroid', () => {
    it('should find center of multiple points', () => {
      const points = [
        { lat: 0, lng: 0 },
        { lat: 10, lng: 10 }
      ];
      const centroid = getCentroid(points);
      expect(centroid).toEqual({ lat: 5, lng: 5 });
    });
  });
});