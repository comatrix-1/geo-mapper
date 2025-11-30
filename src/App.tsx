import React, { useState, useEffect, useCallback } from 'react';
import MapBoard from './components/MapBoard';
import LayerSidebar from './components/LayerSidebar';
import Toolbar from './components/Toolbar';
import AuthWidget from './components/AuthWidget';
import type { DrawingMode, Layer as CustomLayer, MapObject } from './types';
import type { LatLngLiteral } from 'leaflet';
import { saveProjectToFile, loadProjectFromFile } from './utils/fileImporter';

// Firebase Imports
import { onAuthStateChanged, type User } from 'firebase/auth';
import { 
    auth, 
    loadUserData, 
    saveLayers, 
    saveObject, 
    deleteObject, 
    saveObjectsBatch 
} from './utils/firebase';

const DEFAULT_LAYERS: CustomLayer[] = [
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
  
  // App State
  const [layers, setLayers] = useState<CustomLayer[]>(DEFAULT_LAYERS);
  const [activeLayerId, setActiveLayerId] = useState<string>(DEFAULT_LAYERS[0].id);
  const [objects, setObjects] = useState<MapObject[]>([]);
  
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('none');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [flyToTarget, setFlyToTarget] = useState<{ id: string, time: number } | null>(null);
  const [rulerPoints, setRulerPoints] = useState<LatLngLiteral[]>([]);

  // 1. Auth Listener & Initial Load
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        // Reset to defaults if logged out
        setLayers(DEFAULT_LAYERS);
        setObjects([]);
        setActiveLayerId(DEFAULT_LAYERS[0].id);
      } else {
        // Load data from Firestore (Root + Subcollection)
        try {
            const data = await loadUserData(currentUser.uid);
            if (data.layers) {
                setLayers(data.layers);
                // Fix active layer if it disappeared
                if (!data.layers.find(l => l.id === activeLayerId)) {
                    setActiveLayerId(data.layers[0]?.id || DEFAULT_LAYERS[0].id);
                }
            } else {
                // Initialize default layers for new user in background
                saveLayers(currentUser.uid, DEFAULT_LAYERS);
            }
            if (data.objects) setObjects(data.objects);
        } catch (err) {
            console.error("Failed to load user data:", err);
        }
      }
    });
    return () => unsubscribe();
  }, []); // Run once on mount

  // Data integrity: Ensure active layer always exists locally
  useEffect(() => {
      if (layers.length > 0 && !layers.find(l => l.id === activeLayerId)) {
          setActiveLayerId(layers[0].id);
      }
  }, [layers, activeLayerId]);


  // --- Handlers (With Persistence) ---

  const addLayer = () => {
    const newId = crypto.randomUUID();
    const colors = ['#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const newLayer: CustomLayer = {
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
    const newLayers = [...layers, newLayer];
    setLayers(newLayers);
    setActiveLayerId(newId);
    
    if (user) saveLayers(user.uid, newLayers);
  };

  const handleDeleteLayer = (id: string) => {
    if (layers.length <= 1) return;
    
    const newLayers = layers.filter(l => l.id !== id);
    setLayers(newLayers);
    
    // Also delete objects in this layer
    const objectsToDelete = objects.filter(o => o.layerId === id);
    const objectsToKeep = objects.filter(o => o.layerId !== id);
    setObjects(objectsToKeep);

    if (activeLayerId === id) {
      setActiveLayerId(newLayers[0].id);
    }

    if (user) {
        saveLayers(user.uid, newLayers);
        // We should delete subcollection docs too
        objectsToDelete.forEach(obj => deleteObject(user.uid, obj.id));
    }
  };

  const toggleLayerVisibility = (id: string) => {
    const newLayers = layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l);
    setLayers(newLayers);
    if (user) saveLayers(user.uid, newLayers);
  };

  const updateLayer = (updatedLayer: CustomLayer) => {
      const newLayers = layers.map(l => l.id === updatedLayer.id ? updatedLayer : l);
      setLayers(newLayers);
      if (user) saveLayers(user.uid, newLayers);
  };

  // Import handler
  const handleImportLayer = (newLayer: CustomLayer, newObjects: MapObject[]) => {
      const newLayers = [...layers, newLayer];
      setLayers(newLayers);
      setObjects([...objects, ...newObjects]);
      setActiveLayerId(newLayer.id);

      if (user) {
          saveLayers(user.uid, newLayers);
          saveObjectsBatch(user.uid, newObjects);
      }
  };

  // Object Handlers
  const handleNewObject = (obj: MapObject) => {
      if (user) saveObject(user.uid, obj);
  };

  const handleObjectUpdate = (updatedObject: MapObject) => {
      if (user) saveObject(user.uid, updatedObject);
  };

  const handleObjectDelete = (id: string) => {
      if (user) deleteObject(user.uid, id);
  };

  // Save Project Handler (File export)
  const handleSaveProject = () => {
      saveProjectToFile(layers, objects);
  };

  // Load Project Handler (File import)
  const handleLoadProject = async (file: File) => {
      try {
          const { layers: loadedLayers, objects: loadedObjects } = await loadProjectFromFile(file);
          if (confirm('Loading a project file will overwrite your local view. \n\nNote: If you are logged in, this will perform a bulk overwrite of your cloud data. Continue?')) {
              setLayers(loadedLayers);
              setObjects(loadedObjects);
              if (loadedLayers.length > 0) {
                  setActiveLayerId(loadedLayers[0].id);
              }
              
              if (user) {
                  saveLayers(user.uid, loadedLayers);
                  // For a full project load, strictly we should delete old objects, but that's complex.
                  // For now, we just save the new ones on top.
                  saveObjectsBatch(user.uid, loadedObjects);
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
        deleteLayer={handleDeleteLayer}
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
        onObjectUpdate={handleObjectUpdate}
        onObjectDelete={handleObjectDelete}
        onNewObject={handleNewObject}
      />
    </div>
  );
};

export default App;