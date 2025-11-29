import React, { useState, useEffect, useCallback } from 'react';
import MapBoard from './components/MapBoard';
import LayerSidebar from './components/LayerSidebar';
import Toolbar from './components/Toolbar';
import AuthWidget from './components/AuthWidget';
import type { DrawingMode, Layer, MapObject } from './types';
import type { LatLngLiteral } from 'leaflet';
import { saveProjectToFile, loadProjectFromFile } from './utils/fileImporter';

// Firebase Imports
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './utils/firebase';

const DEFAULT_LAYERS: Layer[] = [
  { 
      id: '1', 
      name: 'Points of Interest', 
      visible: true, 
      style: { borderColor: '#ef4444', borderWidth: 2, fillColor: '#ef4444', fillOpacity: 0.2 } 
  },
  { 
      id: '2', 
      name: 'Boundaries', 
      visible: true, 
      style: { borderColor: '#3b82f6', borderWidth: 2, fillColor: '#3b82f6', fillOpacity: 0.2 } 
  },
];

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // App State
  const [layers, setLayers] = useState<Layer[]>(DEFAULT_LAYERS);
  const [activeLayerId, setActiveLayerId] = useState<string>(DEFAULT_LAYERS[0].id);
  const [objects, setObjects] = useState<MapObject[]>([]);
  
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('none');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [flyToTarget, setFlyToTarget] = useState<{ id: string, time: number } | null>(null);
  const [rulerPoints, setRulerPoints] = useState<LatLngLiteral[]>([]);

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        // Reset to defaults if logged out
        setLayers(DEFAULT_LAYERS);
        setObjects([]);
        setActiveLayerId(DEFAULT_LAYERS[0].id);
        setIsDataLoaded(true); // Technically loaded "default" state
      } else {
        setIsDataLoaded(false); // Waiting for Firestore
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Firestore Sync (Read)
  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, 'users', user.uid);

    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.layers) setLayers(data.layers);
        if (data.objects) setObjects(data.objects);
        // If we just loaded and activeLayerId isn't valid, fix it
        if (data.layers && data.layers.length > 0) {
            setActiveLayerId(prev => data.layers.find((l: Layer) => l.id === prev) ? prev : data.layers[0].id);
        }
      } else {
        // New user - create initial doc
        setDoc(userDocRef, {
            layers: DEFAULT_LAYERS,
            objects: []
        }, { merge: true });
      }
      setIsDataLoaded(true);
    }, (error) => {
        console.error("Error fetching data:", error);
        setIsDataLoaded(true);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. Firestore Sync (Write / Auto-save)
  // We debounce this slightly to avoid hammering Firestore on every drag pixel
  useEffect(() => {
    if (!user || !isDataLoaded) return;

    const saveData = async () => {
        try {
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, {
                layers: layers,
                objects: objects
            }, { merge: true });
        } catch (e) {
            console.error("Auto-save failed", e);
        }
    };

    const timeoutId = setTimeout(saveData, 1000); // 1 second debounce
    return () => clearTimeout(timeoutId);

  }, [layers, objects, user, isDataLoaded]);

  // Data integrity: Ensure active layer always exists
  useEffect(() => {
      if (layers.length > 0 && !layers.find(l => l.id === activeLayerId)) {
          setActiveLayerId(layers[0].id);
      }
  }, [layers, activeLayerId]);


  // --- Handlers ---

  const addLayer = () => {
    const newId = crypto.randomUUID();
    const colors = ['#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const newLayer: Layer = {
      id: newId,
      name: `Layer ${layers.length + 1}`,
      visible: true,
      style: {
          borderColor: randomColor,
          borderWidth: 2,
          fillColor: randomColor,
          fillOpacity: 0.2
      }
    };
    setLayers([...layers, newLayer]);
    setActiveLayerId(newId);
  };

  const deleteLayer = (id: string) => {
    if (layers.length <= 1) return;
    setLayers(layers.filter(l => l.id !== id));
    setObjects(objects.filter(o => o.layerId !== id));
    if (activeLayerId === id) {
      setActiveLayerId(layers.find(l => l.id !== id)?.id || layers[0].id);
    }
  };

  const toggleLayerVisibility = (id: string) => {
    setLayers(layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  const updateLayer = (updatedLayer: Layer) => {
      setLayers(prev => prev.map(l => l.id === updatedLayer.id ? updatedLayer : l));
  };

  // Import handler
  const handleImportLayer = (newLayer: Layer, newObjects: MapObject[]) => {
      setLayers([...layers, newLayer]);
      setObjects([...objects, ...newObjects]);
      setActiveLayerId(newLayer.id);
  };

  // Save Project Handler (File export)
  const handleSaveProject = () => {
      saveProjectToFile(layers, objects);
  };

  // Load Project Handler (File import)
  const handleLoadProject = async (file: File) => {
      try {
          const { layers: loadedLayers, objects: loadedObjects } = await loadProjectFromFile(file);
          if (confirm('Loading a project file will overwrite your current cloud data. Continue?')) {
              setLayers(loadedLayers);
              setObjects(loadedObjects);
              if (loadedLayers.length > 0) {
                  setActiveLayerId(loadedLayers[0].id);
              }
          }
      } catch (err) {
          alert("Failed to load project: " + err);
      }
  };

  const handleSetDrawingMode = (mode: DrawingMode) => {
    setDrawingMode(mode);
    if (mode !== 'ruler') {
        setRulerPoints([]);
    }
    if (mode !== 'none') {
        setSelectedObjectId(null);
    }
  };

  const handleObjectClick = (id: string) => {
      setSelectedObjectId(id);
      setFlyToTarget({ id, time: Date.now() });
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-100">
      
      <Toolbar 
        activeMode={drawingMode} 
        setMode={handleSetDrawingMode} 
      />

      <LayerSidebar
        layers={layers}
        activeLayerId={activeLayerId}
        setActiveLayerId={setActiveLayerId}
        toggleLayerVisibility={toggleLayerVisibility}
        addLayer={addLayer}
        deleteLayer={deleteLayer}
        updateLayer={updateLayer}
        objects={objects}
        selectedObjectId={selectedObjectId}
        onObjectClick={handleObjectClick}
        onImportLayer={handleImportLayer}
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProject}
      />

      {/* Top Right Controls */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-2 pointer-events-none">
          {/* Logo/Title */}
          <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-sm border border-gray-200 pointer-events-auto">
             <h1 className="font-bold text-gray-800">GeoLayer Mapper</h1>
          </div>
          
          {/* Auth Widget */}
          <div className="pointer-events-auto">
             <AuthWidget user={user} />
          </div>

          {!user && (
              <div className="bg-yellow-50 text-yellow-800 text-xs px-3 py-1.5 rounded-md border border-yellow-200 shadow-sm max-w-[200px] pointer-events-auto">
                  Sign in to sync your map across devices.
              </div>
          )}
      </div>

      {drawingMode === 'ruler' && rulerPoints.length > 0 && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full z-[1000] text-sm animate-fade-in-up">
              Click to measure, Double Click to finish
          </div>
      )}

      {drawingMode !== 'none' && drawingMode !== 'ruler' && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full z-[1000] text-sm shadow-lg animate-fade-in-up">
              Drawing Mode: {drawingMode.charAt(0).toUpperCase() + drawingMode.slice(1)} (Double click to finish shape)
          </div>
      )}

      <MapBoard
        layers={layers}
        activeLayerId={activeLayerId}
        drawingMode={drawingMode}
        setDrawingMode={handleSetDrawingMode}
        objects={objects}
        setObjects={setObjects}
        selectedObjectId={selectedObjectId}
        setSelectedObjectId={setSelectedObjectId}
        rulerPoints={rulerPoints}
        setRulerPoints={setRulerPoints}
        flyToTarget={flyToTarget}
      />
    </div>
  );
};

export default App;