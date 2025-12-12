import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Trash2, Plus, ShieldCheck, Car, Building2, Pencil, Layers, Search, X } from 'lucide-react';
import { SpotStatus, SpotType } from '../types';
import { ConfirmationModal } from '../components/ConfirmationModal';

export const Admin: React.FC = () => {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-100 rounded-lg text-brand-600">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Administración</h1>
            <p className="text-slate-500">Gestión de Vehículos</p>
          </div>
        </div>
      </div>

      <VehicleManager />
    </div>
  );
};

// --- SUB-COMPONENT: VEHICLE MANAGER ---
const VehicleManager: React.FC = () => {
  const allVehicles = useLiveQuery(() => db.vehicles.toArray()) || [];
  const [searchTerm, setSearchTerm] = useState('');
  
  // FORM STATE
  const [plate, setPlate] = useState('');
  const [office, setOffice] = useState('');
  const [allowedSpots, setAllowedSpots] = useState('');
  const [isDoubleSpot, setIsDoubleSpot] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Confirmation Modal State
  const [vehicleToDelete, setVehicleToDelete] = useState<string | null>(null);

  // --- FILTERING & SORTING LOGIC ---
  const processedVehicles = allVehicles
    .filter(v => {
      const term = searchTerm.toLowerCase();
      return v.plate.toLowerCase().includes(term) || v.office.toLowerCase().includes(term);
    })
    .sort((a, b) => {
      // Natural Sort for Office Numbers (e.g., "Oficina 2" before "Oficina 10")
      // Extract numbers from strings
      const numA = parseInt(a.office.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.office.replace(/\D/g, '')) || 0;

      if (numA !== numB) {
        return numA - numB;
      }
      // If numbers are equal or missing, fall back to alphabetical
      return a.office.localeCompare(b.office);
    });


  // --- HANDLERS ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate || !office) return;

    const rawSpots = allowedSpots.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
    const finalAllowedSpots: string[] = [];

    try {
      // Use a transaction to ensure vehicle saved AND spots created atomically
      await (db as any).transaction('rw', db.vehicles, db.parkingSpots, async () => {
        
        // Process each spot ID
        for (const rawId of rawSpots) {
          if (isDoubleSpot) {
            // Generate split IDs for double spots (e.g., A1 -> A1-1, A1-2)
            const id1 = `${rawId}-1`;
            const id2 = `${rawId}-2`;
            finalAllowedSpots.push(id1, id2);

            await ensureSpotExists(id1, office);
            await ensureSpotExists(id2, office);
          } else {
            // Normal processing
            finalAllowedSpots.push(rawId);
            await ensureSpotExists(rawId, office);
          }
        }

        await db.vehicles.put({
          plate: plate.toUpperCase(),
          office: office,
          allowedSpots: finalAllowedSpots
        });
      });

      resetForm();
    } catch (err) {
      console.error(err);
      alert('Error al guardar vehículo.');
    }
  };

  // Helper to create spot if missing
  const ensureSpotExists = async (id: string, officeName: string) => {
    const existing = await db.parkingSpots.get(id);
    if (!existing) {
      await db.parkingSpots.add({
        id: id,
        status: SpotStatus.FREE,
        type: SpotType.NORMAL, // Individual slots are normal type
        assignedOffices: [officeName]
      });
    }
  };

  const handleEdit = (v: any) => {
    setPlate(v.plate);
    setOffice(v.office);
    setAllowedSpots(v.allowedSpots.join(', '));
    setIsDoubleSpot(false); // Reset to avoid accidental double expansion on edit
    setIsEditing(true);
    // Scroll to top to see form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const initiateDelete = (plateToDelete: string) => {
    setVehicleToDelete(plateToDelete);
  };

  const executeDelete = async () => {
    if (!vehicleToDelete) return;
    try {
      await db.vehicles.delete(vehicleToDelete);
      if (plate === vehicleToDelete) resetForm();
    } catch (error) {
      console.error(error);
      alert('Error al eliminar');
    } finally {
      setVehicleToDelete(null);
    }
  };

  const resetForm = () => {
    setPlate('');
    setOffice('');
    setAllowedSpots('');
    setIsDoubleSpot(false);
    setIsEditing(false);
  };

  return (
    <>
      <ConfirmationModal
        isOpen={!!vehicleToDelete}
        title="¿Eliminar Vehículo?"
        message={`Estás seguro de que deseas eliminar el vehículo con placa ${vehicleToDelete}. Esta acción no se puede deshacer.`}
        onConfirm={executeDelete}
        onCancel={() => setVehicleToDelete(null)}
        isDestructive={true}
      />
      
      <div className="grid md:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Form */}
        <div className="md:col-span-1">
          <div className={`bg-white rounded-xl shadow-sm border p-6 sticky top-6 ${isEditing ? 'border-amber-400 ring-1 ring-amber-400' : 'border-slate-200'}`}>
            <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isEditing ? 'text-amber-600' : 'text-slate-800'}`}>
              {isEditing ? <Pencil size={20} /> : <Plus size={20} className="text-brand-500" />} 
              {isEditing ? 'Editar Vehículo' : 'Nuevo Vehículo'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Placa</label>
                <input
                  type="text"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 font-mono uppercase disabled:bg-slate-100 disabled:text-slate-500"
                  placeholder="ABC-123"
                  required
                  disabled={isEditing} // Primary Key usually shouldn't change in edit mode easily without delete/create
                />
                {isEditing && <p className="text-xs text-amber-600 mt-1">La placa no se puede editar.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Oficina(s)</label>
                <div className="relative">
                    <Building2 className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input
                    type="text"
                    value={office}
                    onChange={(e) => setOffice(e.target.value)}
                    className="w-full pl-10 p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                    placeholder="Ej: Oficina 305"
                    required
                    />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parqueadero(s)</label>
                <input
                  type="text"
                  value={allowedSpots}
                  onChange={(e) => setAllowedSpots(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 uppercase"
                  placeholder="A1, B2 (Separados por coma)"
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <input
                      type="checkbox"
                      id="isDouble"
                      checked={isDoubleSpot}
                      onChange={(e) => setIsDoubleSpot(e.target.checked)}
                      className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500 border-gray-300"
                  />
                  <label htmlFor="isDouble" className="cursor-pointer select-none">
                      <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
                          <Layers size={16} /> ¿Puesto Doble? (x2)
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                          Si ingresas "A1", se crearán "A1-1" y "A1-2"
                      </span>
                  </label>
              </div>
              
              <div className="flex gap-2">
                {isEditing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  className={`flex-1 py-2.5 text-white font-bold rounded-lg shadow transition-colors flex justify-center gap-2 ${
                    isEditing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-brand-600 hover:bg-brand-700'
                  }`}
                >
                  <SaveIcon /> {isEditing ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* List */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
             <h2 className="text-lg font-bold text-slate-800">Vehículos Registrados ({processedVehicles.length})</h2>
             
             {/* Admin Search Bar */}
             <div className="relative w-full sm:w-64">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar placa u oficina..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                />
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                {searchTerm && (
                    <button 
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                    >
                        <X size={16} />
                    </button>
                )}
             </div>
          </div>

          {processedVehicles.length === 0 ? (
            <EmptyState 
                message={allVehicles.length === 0 ? "No hay vehículos registrados." : "No se encontraron resultados para tu búsqueda."} 
                icon={<Car className="mx-auto h-12 w-12 text-slate-300 mb-2" />} 
            />
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Placa</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Oficina(s)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Parqueadero(s)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {processedVehicles.map((v) => (
                    <tr key={v.plate} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 bg-slate-100 rounded text-slate-800 font-mono font-bold">
                            {v.plate}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium flex items-center gap-2">
                        <Building2 size={16} className="text-slate-400" />
                        {v.office}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {v.allowedSpots.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                                {v.allowedSpots.map(s => (
                                    <span key={s} className="px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded text-xs border border-brand-100">{s}</span>
                                ))}
                            </div>
                        ) : <span className="text-slate-300 italic">Ninguno</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(v)}
                          className="text-amber-600 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 p-2 rounded transition-colors"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => initiateDelete(v.plate)}
                          className="text-rose-600 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 p-2 rounded transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const EmptyState = ({ message, icon }: { message: string, icon: React.ReactNode }) => (
  <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
      {icon}
      <p className="text-slate-500">{message}</p>
  </div>
);

const SaveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
);