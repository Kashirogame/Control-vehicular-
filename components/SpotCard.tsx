import React from 'react';
import { ParkingSpot, SpotStatus } from '../types';
import { Car, User, CheckCircle2, Building2, Trash2 } from 'lucide-react';

interface SpotCardProps {
  spot: ParkingSpot;
  onClick: (spot: ParkingSpot) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
}

export const SpotCard: React.FC<SpotCardProps> = ({ spot, onClick, selectionMode, isSelected }) => {
  const isFree = spot.status === SpotStatus.FREE;
  const isVisitor = spot.status === SpotStatus.VISITOR;

  // Base classes
  let baseClasses = "relative p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer shadow-sm flex flex-col justify-between h-36 select-none";
  
  // Selection Mode Overrides
  if (selectionMode) {
      baseClasses += isSelected 
        ? " bg-rose-50 border-rose-500 ring-2 ring-rose-300 scale-95" 
        : " bg-white border-slate-200 hover:border-rose-300 opacity-60 hover:opacity-100 grayscale";
  } else {
      // Normal Status Colors
      baseClasses += " hover:shadow-md";
      if (isFree) baseClasses += " bg-emerald-50 border-emerald-200 hover:border-emerald-400 text-emerald-800";
      else if (isVisitor) baseClasses += " bg-amber-50 border-amber-200 hover:border-amber-400 text-amber-900";
      else baseClasses += " bg-rose-50 border-rose-200 hover:border-rose-400 text-rose-900";
  }

  return (
    <div 
      onClick={() => onClick(spot)}
      className={baseClasses}
    >
      {/* Selection Overlay Icon */}
      {selectionMode && (
          <div className={`absolute top-2 right-2 rounded-full p-1 ${isSelected ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
              <Trash2 size={14} />
          </div>
      )}

      <div className="flex justify-between items-start">
        <span className="font-bold text-2xl tracking-tight opacity-75">{spot.id}</span>
        {!selectionMode && (
            <>
                {isFree ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                ) : (
                <Car className={`w-6 h-6 ${isVisitor ? 'text-amber-500' : 'text-rose-500'}`} />
                )}
            </>
        )}
      </div>

      <div className="mt-1">
        {isFree ? (
          <>
            {!selectionMode && (
                <div className="flex items-center text-sm font-medium text-emerald-600 mb-2">
                <span className="bg-emerald-100 px-2 py-1 rounded text-xs">DISPONIBLE</span>
                </div>
            )}
            {spot.assignedOffices && spot.assignedOffices.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {spot.assignedOffices.slice(0, 2).map((office, idx) => (
                  <span key={idx} className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 truncate max-w-full border ${selectionMode ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-white/60 border-emerald-200'}`}>
                     {!selectionMode && <Building2 size={10} />} {office}
                  </span>
                ))}
                {spot.assignedOffices.length > 2 && (
                   <span className="text-[10px] bg-white/60 px-1 rounded">+{spot.assignedOffices.length - 2}</span>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-wider uppercase truncate">
              {spot.vehiclePlate || '---'}
            </span>
            {!selectionMode && isVisitor && (
              <div className="flex items-center gap-1 text-xs text-amber-700 mt-1 truncate">
                <User size={12} />
                <span className="truncate">{spot.visitorName}</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {spot.type === 'DOBLE' && (
        <div className="absolute top-2 right-2 opacity-10">
            <div className="text-[0.5rem] font-bold border border-current px-1 rounded">2X</div>
        </div>
      )}
    </div>
  );
};