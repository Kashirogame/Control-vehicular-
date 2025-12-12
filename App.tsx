import React, { createContext, useContext, useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Database, LayoutGrid, Trash2, X } from 'lucide-react';
import { Dashboard } from './pages/Dashboard';
import { Admin } from './pages/Admin';

// --- Context Definition ---
interface DeleteModeContextType {
  isDeleteMode: boolean;
  toggleDeleteMode: () => void;
}

const DeleteModeContext = createContext<DeleteModeContextType>({
  isDeleteMode: false,
  toggleDeleteMode: () => {},
});

export const useDeleteMode = () => useContext(DeleteModeContext);

// --- Layout Component ---
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const isAdmin = location.pathname === '/admin';
  const { isDeleteMode, toggleDeleteMode } = useDeleteMode();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar / Header */}
      <header className={`text-white p-4 sticky top-0 z-40 shadow-md flex justify-between items-center transition-colors duration-300 ${
        isDeleteMode ? 'bg-rose-900' : 'bg-slate-900'
      }`}>
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-xl transition-colors ${
                isDeleteMode ? 'bg-rose-500' : 'bg-brand-500'
            }`}>C</div>
            <span className="font-bold text-lg tracking-tight">Control Vehicular</span>
        </Link>

        <div className="flex items-center gap-3">
            {/* Delete Mode Toggle (Only on Dashboard) */}
            {!isAdmin && (
                <button
                    onClick={toggleDeleteMode}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-bold shadow-sm ${
                        isDeleteMode 
                        ? 'bg-white text-rose-700 hover:bg-rose-50' 
                        : 'bg-rose-600 text-white hover:bg-rose-500 shadow-rose-900/20'
                    }`}
                >
                    {isDeleteMode ? <X size={18} /> : <Trash2 size={18} />}
                    <span>{isDeleteMode ? 'Cancelar' : 'Eliminar Casillas'}</span>
                </button>
            )}

            {/* Navigation Button */}
            <Link
            to={isAdmin ? "/" : "/admin"}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-bold shadow-sm ${
                isAdmin 
                ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 hover:text-white' 
                : isDeleteMode
                    ? 'opacity-50 pointer-events-none bg-slate-800' // Disable admin nav in delete mode
                    : 'bg-brand-600 text-white hover:bg-brand-500 shadow-brand-500/20'
            }`}
            >
            {isAdmin ? (
                <>
                <LayoutGrid size={18} />
                <span>Ver Panel</span>
                </>
            ) : (
                <>
                <Database size={18} />
                <span>Base de Datos</span>
                </>
            )}
            </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-slate-100 relative">
        {children}
      </main>
    </div>
  );
};

export default function App() {
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  const toggleDeleteMode = () => {
    setIsDeleteMode(prev => !prev);
  };

  return (
    <DeleteModeContext.Provider value={{ isDeleteMode, toggleDeleteMode }}>
        <HashRouter>
        <Layout>
            <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/admin" element={<Admin />} />
            </Routes>
        </Layout>
        </HashRouter>
    </DeleteModeContext.Provider>
  );
}