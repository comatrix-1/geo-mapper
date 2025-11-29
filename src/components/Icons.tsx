import L from 'leaflet';

export const createMarkerIcon = (color: string = '#3b82f6') => {
  // Manual SVG construction to avoid react-dom/server dependency
  const svg = `
    <div class="relative flex items-center justify-center w-8 h-8">
       <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin drop-shadow-md">
         <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
         <circle cx="12" cy="10" r="3"/>
       </svg>
    </div>
  `;
  
  return L.divIcon({
    html: svg,
    className: 'custom-leaflet-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

export const createMoveHandleIcon = () => {
  const svg = `
    <div class="bg-white rounded-full p-1 border-2 border-gray-800 shadow-lg cursor-move hover:bg-gray-100 transition-colors flex items-center justify-center w-full h-full">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1f2937" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-move">
        <polyline points="5 9 2 12 5 15"/>
        <polyline points="9 5 12 2 15 5"/>
        <polyline points="15 19 12 22 9 19"/>
        <polyline points="19 9 22 12 19 15"/>
        <line x1="2" x2="22" y1="12" y2="12"/>
        <line x1="12" x2="12" y1="2" y2="22"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    html: svg,
    className: 'custom-move-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

export const createVertexIcon = () => {
    return L.divIcon({
        className: 'bg-white border-2 border-gray-800 rounded-full',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
    });
};