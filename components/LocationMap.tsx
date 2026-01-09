import React, { useEffect, useRef } from 'react';

// Declare L for TypeScript since it's loaded via CDN
declare const L: any;

interface LocationMapProps {
  lat: number;
  lng: number;
  radius: number;
  onLocationSelect: (lat: number, lng: number) => void;
}

export const LocationMap: React.FC<LocationMapProps> = ({ lat, lng, radius, onLocationSelect }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerInstance = useRef<any>(null);
  const circleInstance = useRef<any>(null);

  useEffect(() => {
    if (!mapContainer.current || typeof L === 'undefined') return;

    // Initialize map if not already done
    if (!mapInstance.current) {
      // Default view
      mapInstance.current = L.map(mapContainer.current).setView([lat, lng], 16);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstance.current);

      // Add click handler
      mapInstance.current.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        onLocationSelect(lat, lng);
      });
    }

    // Update marker (Use CircleMarker for simplicity/no-icon-asset dependency)
    if (markerInstance.current) {
        markerInstance.current.setLatLng([lat, lng]);
    } else {
        markerInstance.current = L.circleMarker([lat, lng], {
            color: '#0ea5e9',
            fillColor: '#0ea5e9',
            fillOpacity: 1,
            radius: 8
        }).addTo(mapInstance.current);
    }

    // Update Radius Circle
    if (circleInstance.current) {
        circleInstance.current.setLatLng([lat, lng]);
        circleInstance.current.setRadius(radius);
    } else {
        circleInstance.current = L.circle([lat, lng], {
            color: '#0ea5e9',
            fillColor: '#0ea5e9',
            fillOpacity: 0.2,
            radius: radius
        }).addTo(mapInstance.current);
    }
    
    // Pan map to new center
    mapInstance.current.setView([lat, lng]);

  }, [lat, lng, radius, onLocationSelect]);

  return <div ref={mapContainer} className="w-full h-64 rounded-xl border border-slate-200 dark:border-slate-700 z-0 overflow-hidden" />;
};