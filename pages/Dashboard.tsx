import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { SpotStatus, ParkingSpot, Vehicle } from '../types';
import { ParkingGrid } from '../components/ParkingGrid';
import { Search, X, Car, User, Save, LogOut, Building2, Trash2, Info, MapPin } from 'lucide-react';
import { useDeleteMode } from '../App';
import { ConfirmationModal } from '../components/ConfirmationModal';

export const Dashboard: React.FC = () => {
  const { isDeleteMode, toggleDeleteMode } = useDeleteMode();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [inputPlate, setInputPlate] = useState('');
  const [inputVisitorName, setInputVisitorName] = useState('');
  const [isVisitor, setIsVisitor] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete Mode State
  const [spotsToDelete, setSpotsToDelete] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset delete selection when mode is toggled off
  useEffect(() => {
    if (!isDeleteMode) setSpotsToDelete([]);
  }, [isDeleteMode]);

  // --- DATA FETCHING ---
  const allSpots = useLiveQuery(() => db.parkingSpots.toArray()) || [];
  const registeredVehicles = useLiveQuery(() => db.vehicles.toArray()) || [];

  // --- ADVANCED SEARCH LOGIC ---
  const searchResults = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return { vehicles: [], offices: [] };

    const term = searchTerm.toLowerCase();

    // 1. Find Vehicles by Plate
    const foundVehicles = registeredVehicles.filter(v => v.plate.toLowerCase().includes(term));

    // 2. Find Offices (by searching in Vehicle office string or Spot assignedOffices)
    // We collect all unique office names from DB that match the term
    const distinctOffices = new Set<string>();
    
    // Check in vehicles
    registeredVehicles.forEach(v => {
        if (v.office.toLowerCase().includes(term)) distinctOffices.add(v.office);
    });
    // Check in spots
    allSpots.forEach(s => {
        s.assignedOffices?.forEach(o => {
            if (o.toLowerCase().includes(term)) distinctOffices.add(o);
        });
    });

    const foundOffices = Array.from(distinctOffices).map(officeName => {
        // Gather stats for this office
        const officeVehicles = registeredVehicles.filter(v => v.office === officeName);
        const officeSpots = allSpots.filter(s => s.assignedOffices?.includes(officeName));
        return {
            name: officeName,
            vehicles: officeVehicles,
            spots: officeSpots
        };
    });

    return { vehicles: foundVehicles, offices: foundOffices };
  }, [searchTerm, registeredVehicles, allSpots]);


  // --- GRID FILTERING ---
  const filteredSpots = allSpots.filter(spot => {
    const term = searchTerm.toLowerCase();
    const matchId = spot.id.toLowerCase().includes(term);
    const matchPlate = spot.vehiclePlate?.toLowerCase().includes(term);
    // Also show spots if they belong to an office being searched
    const matchOffice = spot.assignedOffices?.some(o => o.toLowerCase().includes(term));
    
    return matchId || matchPlate || matchOffice;
  });

  // --- HANDLERS ---
  const handleSpotClick = (spot: ParkingSpot) => {
    if (isDeleteMode) {
        setSpotsToDelete(prev => 
            prev.includes(spot.id) ? prev.filter(id => id !== spot.id) : [...prev, spot.id]
        );
    } else {
        setSelectedSpot(spot);
        setModalOpen(true);
        setInputPlate('');
        setInputVisitorName('');
        setIsVisitor(false);
        setError(null);
    }
  };

  const handleAssign = async () => {
    if (!selectedSpot || !inputPlate) return;
    try {
      if (!isVisitor) {
        const vehicle = registeredVehicles.find(v => v.plate.toLowerCase() === inputPlate.toLowerCase());
        if (!vehicle) {
           setError('Placa no registrada. Use "Es Visitante" si es una excepción.');
           return;
        }
      }
      await db.occupySpot(selectedSpot.id, inputPlate, isVisitor, inputVisitorName);
      setModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Error al asignar');
    }
  };

  const handleRelease = async () => {
    if (!selectedSpot) return;
    try {
      await db.freeSpot(selectedSpot.id);
      setModalOpen(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const executeDelete = async () => {
    try {
        await db.deleteSpots(spotsToDelete);
        setShowDeleteConfirm(false);
        toggleDeleteMode();
    } catch (err) {
        console.error(err);
        alert('Error crítico al eliminar los registros.');
    }
  };

  const authorizedVehicles = selectedSpot 
    ? registeredVehicles.filter(v => v.allowedSpots.includes(selectedSpot.id)) 
    : [];

  // --- UI ---
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 pb-32">
      <ConfirmationModal 
        isOpen={showDeleteConfirm}
        title="¿Eliminar Parqueaderos?"
        message={`Eliminarás ${spotsToDelete.length} parqueaderos y sus vehículos vinculados. Irreversible.`}
        onConfirm={executeDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText="Eliminar Todo"
        isDestructive={true}
      />

      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            {isDeleteMode ? (
                <div className="text-rose-600 animate-in slide-in-from-left-2">
                    <h1 className="text-3xl font-black flex items-center gap-2">
                        <Trash2 /> MODO ELIMINAR
                    </h1>
                    <p className="text-rose-800 font-medium">Selecciona las casillas que deseas borrar.</p>
                </div>
            ) : (
                <>
                    <h1 className="text-3xl font-bold text-slate-800">Panel de Control</h1>
                </>
            )}
        </div>
        
        {!isDeleteMode && (
            <div className="flex gap-4">
                <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 text-center min-w-[100px]">
                    <div className="text-xs text-slate-400 uppercase font-bold">Libres</div>
                    <div className="text-2xl font-bold text-emerald-600">
                        {allSpots.filter(s => s.status === SpotStatus.FREE).length}
                    </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 text-center min-w-[100px]">
                    <div className="text-xs text-slate-400 uppercase font-bold">Ocupados</div>
                    <div className="text-2xl font-bold text-rose-600">
                        {allSpots.filter(s => s.status !== SpotStatus.FREE).length}
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative sticky top-4 z-30">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-slate-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-4 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-lg shadow-md transition-all"
          placeholder="Buscar Oficina, Placa o Puesto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={isDeleteMode}
        />
        {searchTerm && (
            <button 
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
                <X size={20} />
            </button>
        )}
      </div>

      {/* --- ADVANCED SEARCH RESULTS SECTION --- */}
      {searchTerm.length >= 2 && !isDeleteMode && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
              
              {/* Vehicle Results */}
              {searchResults.vehicles.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center gap-2 text-sm font-bold text-slate-600">
                          <Car size={16} /> Vehículos Encontrados en BD
                      </div>
                      <div className="divide-y divide-slate-100">
                          {searchResults.vehicles.map(v => (
                              <div key={v.plate} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                  <div>
                                      <div className="font-mono font-black text-xl text-brand-700">{v.plate}</div>
                                      <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                                          <Building2 size={14} className="text-slate-400" /> 
                                          {v.office}
                                      </div>
                                  </div>
                                  <div className="text-right">
                                      <div className="text-xs text-slate-400 uppercase font-bold mb-1">Puestos Permitidos</div>
                                      <div className="flex gap-1 justify-end">
                                          {v.allowedSpots.map(s => (
                                              <span key={s} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-mono font-bold border border-slate-200">
                                                  {s}
                                              </span>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {/* Office Results */}
              {searchResults.offices.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center gap-2 text-sm font-bold text-slate-600">
                          <Building2 size={16} /> Oficinas Encontradas
                      </div>
                      <div className="divide-y divide-slate-100">
                          {searchResults.offices.map(o => (
                              <div key={o.name} className="p-4 hover:bg-slate-50 transition-colors">
                                  <div className="flex justify-between items-start mb-3">
                                      <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                          <Building2 className="text-brand-500" size={20} />
                                          {o.name}
                                      </h3>
                                      <span className="px-2 py-1 bg-brand-50 text-brand-700 rounded-lg text-xs font-bold border border-brand-100">
                                          {o.vehicles.length} Vehículos
                                      </span>
                                  </div>
                                  
                                  {/* Office Details Grid */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {/* Assigned Spots */}
                                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                          <div className="text-xs text-slate-400 uppercase font-bold mb-2 flex items-center gap-1">
                                              <MapPin size={12} /> Puestos Asignados
                                          </div>
                                          <div className="flex flex-wrap gap-1">
                                              {o.spots.length > 0 ? o.spots.map(s => (
                                                  <span key={s.id} className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${
                                                      s.status === SpotStatus.FREE 
                                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                      : 'bg-rose-50 text-rose-700 border-rose-100'
                                                  }`}>
                                                      {s.id}
                                                  </span>
                                              )) : <span className="text-slate-300 text-xs italic">Sin puestos directos</span>}
                                          </div>
                                      </div>

                                      {/* Vehicles List */}
                                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                           <div className="text-xs text-slate-400 uppercase font-bold mb-2 flex items-center gap-1">
                                              <Car size={12} /> Flota Registrada
                                          </div>
                                          <div className="flex flex-wrap gap-2">
                                              {o.vehicles.slice(0, 8).map(v => (
                                                  <span key={v.plate} className="text-xs font-mono text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                                      {v.plate}
                                                  </span>
                                              ))}
                                              {o.vehicles.length > 8 && (
                                                  <span className="text-xs text-slate-400">+ {o.vehicles.length - 8} más</span>
                                              )}
                                              {o.vehicles.length === 0 && <span className="text-slate-300 text-xs italic">Sin vehículos</span>}
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

             
          </div>
      )}
        
      {/* Search Header for Grid */}
      {searchTerm.length > 0 && !isDeleteMode && (
         <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
            <Info size={16} />
            <span>Mostrando resultados en el mapa para "{searchTerm}"</span>
         </div>
      )}

      {/* Grid */}
      <ParkingGrid 
        spots={filteredSpots} 
        onSpotClick={handleSpotClick} 
        selectionMode={isDeleteMode}
        selectedSpots={spotsToDelete}
      />

      {/* --- DELETE CONFIRMATION BAR --- */}
      {isDeleteMode && spotsToDelete.length > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-rose-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-4">
              <span className="font-bold text-lg">{spotsToDelete.length} Seleccionados</span>
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-white text-rose-900 px-6 py-2 rounded-full font-bold hover:bg-rose-100 transition-colors flex items-center gap-2"
              >
                  <Trash2 size={18} /> Eliminar
              </button>
          </div>
      )}

      {/* --- MODAL --- */}
      {modalOpen && selectedSpot && !isDeleteMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className={`p-6 flex justify-between items-center shrink-0 ${
                selectedSpot.status === SpotStatus.FREE ? 'bg-emerald-600' : 'bg-rose-600'
            }`}>
              <div className="text-white">
                <h2 className="text-2xl font-black">Puesto {selectedSpot.id}</h2>
                <div className="text-white/80 font-medium text-sm flex flex-col">
                    <span>{selectedSpot.status === SpotStatus.FREE ? 'Disponible' : 'Ocupado'}</span>
                    {selectedSpot.assignedOffices && selectedSpot.assignedOffices.length > 0 && (
                        <span className="opacity-90 text-xs mt-1">
                            Oficinas: {selectedSpot.assignedOffices.join(', ')}
                        </span>
                    )}
                </div>
              </div>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-white/70 hover:text-white transition-colors bg-white/10 p-1 rounded-full"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {error && (
                <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm flex items-center gap-2">
                    <LogOut size={16} /> {error}
                </div>
              )}

              {selectedSpot.status === SpotStatus.FREE ? (
                // --- ASSIGN FORM ---
                <div className="space-y-5">
                  
                  {/* Visitor Toggle */}
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <input
                      type="checkbox"
                      id="isVisitor"
                      checked={isVisitor}
                      onChange={(e) => {
                          setIsVisitor(e.target.checked);
                          setInputPlate(''); // Clear plate when switching modes
                      }}
                      className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 border-gray-300"
                    />
                    <label htmlFor="isVisitor" className="flex-1 cursor-pointer select-none">
                      <span className="block text-sm font-bold text-slate-700">Modo Visitante</span>
                      <span className="block text-xs text-slate-500">Para vehículos no registrados u ocasionales</span>
                    </label>
                  </div>

                  {!isVisitor ? (
                      // --- AUTHORIZED VEHICLES LIST ---
                      <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                              Vehículos Autorizados ({authorizedVehicles.length})
                          </label>
                          
                          {authorizedVehicles.length > 0 ? (
                              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                                  {authorizedVehicles.map((v) => (
                                      <button
                                          key={v.plate}
                                          onClick={() => setInputPlate(v.plate)}
                                          className={`p-3 rounded-lg border text-left transition-all flex justify-between items-center group ${
                                              inputPlate === v.plate 
                                              ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500' 
                                              : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                                          }`}
                                      >
                                          <div>
                                              <div className="font-mono font-bold text-slate-800">{v.plate}</div>
                                              <div className="text-xs text-slate-500 flex items-center gap-1">
                                                <Building2 size={10} /> {v.office}
                                              </div>
                                          </div>
                                          {inputPlate === v.plate && <CheckCircleIcon />}
                                      </button>
                                  ))}
                              </div>
                          ) : (
                              <div className="text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-500 text-sm">
                                  No hay vehículos asignados exclusivamente a este puesto.
                              </div>
                          )}

                          {authorizedVehicles.length === 0 && (
                              <div className="mt-2">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Entrada Manual (Si es necesario)</label>
                                <input
                                    type="text"
                                    value={inputPlate}
                                    onChange={(e) => setInputPlate(e.target.value.toUpperCase())}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 uppercase font-mono tracking-wider"
                                    placeholder="PLACA"
                                />
                              </div>
                          )}
                      </div>
                  ) : (
                    // --- VISITOR MANUAL INPUT ---
                    <div className="animate-in slide-in-from-top-2 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Placa del Vehículo</label>
                            <div className="relative">
                                <Car className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input
                                type="text"
                                value={inputPlate}
                                onChange={(e) => setInputPlate(e.target.value.toUpperCase())}
                                className="w-full pl-10 p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 uppercase font-mono tracking-wider"
                                placeholder="ABC-123"
                                autoFocus
                                />
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Visitante</label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input
                                type="text"
                                value={inputVisitorName}
                                onChange={(e) => setInputVisitorName(e.target.value)}
                                className="w-full pl-10 p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                                placeholder="Nombre completo"
                                />
                            </div>
                        </div>
                    </div>
                  )}

                  <button
                    onClick={handleAssign}
                    disabled={!inputPlate}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-lg shadow-emerald-600/30 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                  >
                    <Save size={18} />
                    Confirmar Ingreso
                  </button>
                </div>
              ) : (
                // --- RELEASE FORM ---
                <div className="space-y-6 text-center">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="text-sm text-slate-500 uppercase tracking-widest font-semibold mb-1">Vehículo</div>
                        <div className="text-4xl font-black text-slate-800 tracking-wider font-mono">
                            {selectedSpot.vehiclePlate}
                        </div>
                        {selectedSpot.visitorName && (
                            <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-sm font-medium">
                                <User size={14} /> {selectedSpot.visitorName}
                            </div>
                        )}
                         <div className="mt-4 text-xs text-slate-400">
                            Ingreso: {selectedSpot.timestamp ? new Date(selectedSpot.timestamp).toLocaleString() : 'N/A'}
                        </div>
                    </div>

                    <button
                        onClick={handleRelease}
                        className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-lg shadow-rose-600/30 transition-all flex justify-center items-center gap-2"
                    >
                        <LogOut size={18} />
                        Liberar Puesto
                    </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CheckCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
);