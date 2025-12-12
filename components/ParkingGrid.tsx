import React from 'react';
import { ParkingSpot } from '../types';
import { SpotCard } from './SpotCard';

interface ParkingGridProps {
  spots: ParkingSpot[];
  onSpotClick: (spot: ParkingSpot) => void;
  selectionMode?: boolean;
  selectedSpots?: string[];
}

export const ParkingGrid: React.FC<ParkingGridProps> = ({ spots, onSpotClick, selectionMode, selectedSpots = [] }) => {
  if (spots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <p>No se encontraron parqueaderos.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {spots.map((spot) => (
        <SpotCard 
            key={spot.id} 
            spot={spot} 
            onClick={onSpotClick} 
            selectionMode={selectionMode}
            isSelected={selectedSpots.includes(spot.id)}
        />
      ))}
    </div>
  );
};