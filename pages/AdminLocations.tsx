

import React, { useEffect, useState } from 'react';
import { getLocations, createLocation, deleteLocation } from '../services/api';
import { Location } from '../types';
import { MapPin, Plus, Printer, Trash2, X, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LocationMap } from '../components/LocationMap';
import QRCode from 'react-qr-code';

export const AdminLocations = () => {
  const { user } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // New Location Form State
  const [newLocName, setNewLocName] = useState('');
  const [newLocLat, setNewLocLat] = useState('51.505'); // Default London
  const [newLocLng, setNewLocLng] = useState('-0.09');
  const [newLocRadius, setNewLocRadius] = useState('200');

  useEffect(() => {
    const loadData = async () => {
        if (!user || !user.currentCompanyId) return;
        const data = await getLocations(user.currentCompanyId);
        setLocations(data);
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
                onClick={() => setIsAddModalOpen(true)}
                className="bg-brand-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-brand-500/30 hover:bg-brand-600 transition flex items-center space-x-2"
            >
                <Plus className="w-5 h-5" />
                <span>Add Location</span>
            </button>
        </header>

        {locations.length === 0 && !loading && (
            <div className="text-center py-12 text-slate-500">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No locations found. Add one to get started.</p>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locations.map(loc => (
                <div key={loc.id} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between min-h-[12rem]">
                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-brand-50 dark:bg-brand-900/30 text-brand-500 rounded-lg inline-block">
                                <MapPin className="w-6 h-6" />
                            </div>
                            <button 
                                onClick={() => handleDelete(loc.id)}
                                className="text-slate-400 hover:text-danger transition"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white truncate">{loc.name}</h3>
                        <p className="text-slate-500 text-sm mt-1 font-mono bg-slate-50 dark:bg-slate-700/50 inline-block px-2 py-0.5 rounded">
                            {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                        </p>
                        <p className="text-xs text-slate-400 mt-2 flex items-center space-x-1">
                            <span>Radius: {loc.radius}m</span>
                        </p>
                    </div>
                    
                    <button 
                        onClick={() => handlePrint(loc)}
                        className="w-full mt-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center space-x-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition font-medium"
                    >
                        <Printer className="w-4 h-4" />
                        <span>Generate Poster</span>
                    </button>
                </div>
            ))}
        </div>

        {/* Modal for QR Poster */}
        {selectedLocation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl p-8 max-w-lg w-full text-center relative shadow-2xl">
                    <button 
                        onClick={() => setSelectedLocation(null)}
                        className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>

                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-slate-900">{selectedLocation.name}</h2>
                        <p className="text-slate-500">Scan to clock in at this location.</p>
                    </div>

                    <div className="bg-white border-2 border-slate-900 p-6 rounded-2xl inline-block mb-6">
                         <QRCode value={getStaticQrUrl(selectedLocation.id)} size={256} />
                    </div>
                    
                    <div className="flex gap-4">
                        <button 
                            className="flex-1 bg-brand-500 text-white py-3 rounded-xl font-bold hover:bg-brand-600 transition"
                            onClick={() => window.print()}
                        >
                            Print Poster
                        </button>
                         <button 
                            className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition"
                            onClick={() => {
                                navigator.clipboard.writeText(getStaticQrUrl(selectedLocation.id));
                                alert("Link copied!");
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl border dark:border-slate-700 my-8">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Add Location</h2>
                        <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
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
                                        className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" 
                                        placeholder="e.g. West Entrance"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Latitude</label>
                                        <input 
                                            type="number" step="any" required
                                            value={newLocLat} onChange={e => setNewLocLat(e.target.value)}
                                            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" 
                                            placeholder="51.505"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Longitude</label>
                                        <input 
                                            type="number" step="any" required
                                            value={newLocLng} onChange={e => setNewLocLng(e.target.value)}
                                            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" 
                                            placeholder="-0.09"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Geofence Radius (meters)</label>
                                     <input 
                                        type="number" required
                                        value={newLocRadius} onChange={e => setNewLocRadius(e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" 
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
                            <button type="submit" className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-xl transition flex items-center justify-center space-x-2">
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