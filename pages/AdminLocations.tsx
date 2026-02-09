
import React, { useEffect, useState } from 'react';
import { getLocations, createLocation, deleteLocation, getCompany } from '../services/api';
import { Location, Company } from '../types';
import { MapPin, Plus, Printer, Trash2, X, Save, Building, ArrowRight, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LocationMap } from '../components/LocationMap';
import QRCode from 'react-qr-code';
import { APP_NAME } from '../constants';

export const AdminLocations = () => {
  const { user } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [companyName, setCompanyName] = useState(APP_NAME);
  
  // New Location Form State
  const [newLocName, setNewLocName] = useState('');
  const [newLocLat, setNewLocLat] = useState('51.505'); // Default London
  const [newLocLng, setNewLocLng] = useState('-0.09');
  const [newLocRadius, setNewLocRadius] = useState('200');

  useEffect(() => {
    const loadData = async () => {
        if (!user || !user.currentCompanyId) return;
        const [locData, companyData] = await Promise.all([
            getLocations(user.currentCompanyId),
            getCompany(user.currentCompanyId)
        ]);
        setLocations(locData);
        setCompanyName(companyData.name);
        setLoading(false);
    };
    loadData();
  }, [user]);

  // Get current location on mount if adding new
  useEffect(() => {
      if (isAddModalOpen) {
          navigator.geolocation.getCurrentPosition((pos) => {
              setNewLocLat(pos.coords.latitude.toString());
              setNewLocLng(pos.coords.longitude.toString());
          }, (err) => {
              console.log("Could not get location", err);
          });
      }
  }, [isAddModalOpen]);

  const handlePrint = (loc: Location) => {
      setSelectedLocation(loc);
  };

  const handleAddLocation = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user?.currentCompanyId) return;

      const newLoc: Location = {
          id: `loc_${Date.now()}`,
          companyId: user.currentCompanyId,
          name: newLocName,
          lat: parseFloat(newLocLat),
          lng: parseFloat(newLocLng),
          radius: parseInt(newLocRadius)
      };
      
      await createLocation(newLoc);
      setLocations([...locations, newLoc]);
      setIsAddModalOpen(false);
      setNewLocName('');
  };

  const handleDelete = async (id: string) => {
      if (window.confirm("Are you sure you want to delete this location?")) {
          await deleteLocation(id);
          setLocations(locations.filter(l => l.id !== id));
      }
  }

  // Construct the URL for the Static QR
  const getStaticQrUrl = (locId: string) => {
    return `${window.location.protocol}//${window.location.host}/#/action?type=static&lid=${locId}`;
  };

  return (
    <div className="space-y-6 relative">
        <header className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Locations</h1>
                <p className="text-slate-500 dark:text-slate-400">Manage GPS geofences and static QR codes.</p>
            </div>
            <button 
                id="add-location-btn"
                onClick={() => setIsAddModalOpen(true)}
                className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-brand-500/30 hover:bg-brand-700 transition flex items-center space-x-2"
            >
                <Plus className="w-5 h-5" />
                <span>Add Location</span>
            </button>
        </header>

        {locations.length === 0 && !loading && (
            <div className="text-center py-12 text-slate-500 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-white/10">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No locations found. Add one to get started.</p>
            </div>
        )}

        <div className="space-y-3">
            {locations.map((loc, idx) => (
                <div key={loc.id} className="glass-panel bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:shadow-md transition group">
                    
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-lg flex items-center justify-center border border-brand-100 dark:border-brand-500/20">
                            <MapPin className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                {loc.name}
                            </h3>
                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                <span className="font-mono bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded">{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</span>
                                <span>•</span>
                                <span>Radius: {loc.radius}m</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 border-t md:border-t-0 border-slate-100 dark:border-white/5 pt-3 md:pt-0">
                        <button 
                            onClick={() => handlePrint(loc)}
                            id={idx === 0 ? 'location-print-btn' : undefined}
                            className="flex-1 md:flex-none px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-lg transition flex items-center justify-center gap-2"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Poster</span>
                        </button>
                        <button 
                            onClick={() => handleDelete(loc.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                            title="Delete Location"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}
        </div>

        {/* Modal for QR Poster */}
        {selectedLocation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-none md:rounded-3xl p-8 max-w-lg w-full text-center relative shadow-2xl print:shadow-none print:w-screen print:h-screen print:max-w-none print:rounded-none print:flex print:flex-col print:items-center print:justify-center">
                    <button 
                        id="location-poster-close-btn"
                        onClick={() => setSelectedLocation(null)}
                        className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition print:hidden"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>

                    <div className="mb-8 space-y-2">
                        <div className="flex items-center justify-center space-x-2 mb-4 text-slate-400">
                             <Building className="w-5 h-5" />
                             <span className="font-semibold uppercase tracking-widest text-sm">{companyName}</span>
                        </div>
                        <h2 className="text-4xl font-extrabold text-slate-900">{selectedLocation.name}</h2>
                        <p className="text-slate-500 text-lg">Scan to Clock In or Out</p>
                    </div>

                    <div className="bg-white border-4 border-slate-900 p-8 rounded-3xl inline-block mb-8 shadow-xl print:shadow-none">
                         <QRCode value={getStaticQrUrl(selectedLocation.id)} size={300} />
                    </div>
                    
                    <div className="text-slate-400 text-sm font-medium mb-8">
                        <p>1. Open your camera</p>
                        <p>2. Scan the code</p>
                        <p>3. Confirm your location</p>
                    </div>

                    <div className="flex gap-4 print:hidden">
                        <button 
                            className="flex-1 bg-brand-500 text-white py-3 rounded-xl font-bold hover:bg-brand-600 transition shadow-lg shadow-brand-500/30"
                            onClick={() => window.print()}
                        >
                            Print Poster
                        </button>
                         <button 
                            className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition"
                            onClick={() => {
                                navigator.clipboard.writeText(getStaticQrUrl(selectedLocation.id));
                                alert("Link copied to clipboard");
                            }}
                        >
                            Copy Link
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Modal for Add Location */}
        {isAddModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
                <div className="glass-panel w-full max-w-2xl p-6 md:p-8 rounded-3xl shadow-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 my-8">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Add Location</h2>
                        <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleAddLocation} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Location Name</label>
                                    <input 
                                        type="text" required
                                        value={newLocName} onChange={e => setNewLocName(e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none" 
                                        placeholder="e.g. West Entrance"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Latitude</label>
                                        <input 
                                            type="number" step="any" required
                                            value={newLocLat} onChange={e => setNewLocLat(e.target.value)}
                                            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none" 
                                            placeholder="51.505"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Longitude</label>
                                        <input 
                                            type="number" step="any" required
                                            value={newLocLng} onChange={e => setNewLocLng(e.target.value)}
                                            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none" 
                                            placeholder="-0.09"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Geofence Radius (meters)</label>
                                     <input 
                                        type="number" required
                                        value={newLocRadius} onChange={e => setNewLocRadius(e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none" 
                                        placeholder="200"
                                    />
                                </div>
                            </div>
                            
                            {/* Map Column */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tap to select location</label>
                                <LocationMap 
                                    lat={parseFloat(newLocLat) || 51.505} 
                                    lng={parseFloat(newLocLng) || -0.09} 
                                    radius={parseInt(newLocRadius) || 200}
                                    onLocationSelect={(lat, lng) => {
                                        setNewLocLat(lat.toFixed(6));
                                        setNewLocLng(lng.toFixed(6));
                                    }}
                                />
                                <p className="text-xs text-slate-500 text-center">Blue circle shows the active geofence area.</p>
                            </div>
                        </div>

                        <div className="pt-4">
                            <button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl transition flex items-center justify-center space-x-2">
                                <Save className="w-5 h-5" />
                                <span>Save Location</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};
